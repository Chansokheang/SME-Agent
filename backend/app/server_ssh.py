"""Gagesite's connection to an owner's server over SSH: its own key (never a password), held in
memory only, and the server's key remembered on first use (a different one later is refused)."""

import io
import posixpath
import shlex

import paramiko
from sqlmodel import Session

from . import secrets_store
from .db import ApiServer, engine


class SshError(Exception):
    """A plain-language reason the server couldn't be used."""


class _Remember(paramiko.MissingHostKeyPolicy):
    """First connection: accept the server's key and remember it (trust on first use)."""

    def __init__(self) -> None:
        self.seen: str | None = None

    def missing_host_key(self, client, hostname, key) -> None:
        self.seen = f"{key.get_name()} {key.get_base64()}"


class Server:
    def __init__(self, project_id: str) -> None:
        with Session(engine) as session:
            row = session.get(ApiServer, project_id)
        if not row or not (row.ssh_host and row.ssh_user and row.encrypted_ssh_key):
            raise SshError("Add your server's address and user, and Gagesite's key on the server, first.")
        self.project_id = project_id
        self.host, self.port, self.user = row.ssh_host, row.ssh_port or 22, row.ssh_user
        self.known = row.ssh_host_key
        self._key = paramiko.Ed25519Key.from_private_key(io.StringIO(secrets_store.decrypt(row.encrypted_ssh_key)))
        self.client: paramiko.SSHClient | None = None

    def __enter__(self) -> "Server":
        client = paramiko.SSHClient()
        policy = _Remember()
        if self.known:
            name, data = self.known.split(" ", 1)
            client.get_host_keys().add(f"[{self.host}]:{self.port}" if self.port != 22 else self.host, name,
                                       paramiko.PKey.from_type_string(name, __import__("base64").b64decode(data)))
            client.set_missing_host_key_policy(paramiko.RejectPolicy())
        else:
            client.set_missing_host_key_policy(policy)
        try:
            client.connect(self.host, port=self.port, username=self.user, pkey=self._key, timeout=20,
                           allow_agent=False, look_for_keys=False, banner_timeout=20, auth_timeout=20)
        except paramiko.BadHostKeyException:
            raise SshError("Your server's identity changed since Gagesite last connected. If you reinstalled it, "
                           "ask Gagesite to forget the old one; otherwise, don't continue.") from None
        except paramiko.SSHException as exc:
            if "not found in known_hosts" in str(exc):
                raise SshError("Your server's identity changed since Gagesite last connected.") from None
            if "Authentication failed" in str(exc) or isinstance(exc, paramiko.AuthenticationException):
                raise SshError("Your server didn't accept Gagesite's key. Add it to ~/.ssh/authorized_keys for "
                               f"{self.user}, then try again.") from None
            raise SshError(f"Gagesite couldn't talk to your server ({exc}).") from None
        except OSError:
            raise SshError(f"Gagesite couldn't reach {self.host} on port {self.port}. Check the address and that "
                           "SSH is open.") from None
        if policy.seen and not self.known:
            with Session(engine) as session:
                row = session.get(ApiServer, self.project_id)
                row.ssh_host_key = policy.seen
                session.add(row)
                session.commit()
        self.client = client
        return self

    def __exit__(self, *exc) -> None:
        if self.client:
            self.client.close()

    def run(self, command: str, stdin: str | None = None, timeout: int = 900) -> tuple[int, str]:
        """Runs a command (secrets go through stdin, never the command line). Returns (exit code, output)."""
        assert self.client
        chan_in, chan_out, _ = self.client.exec_command(f"bash -lc {shlex.quote(command + ' 2>&1')}", timeout=timeout)
        if stdin is not None:
            chan_in.write(stdin)
        chan_in.channel.shutdown_write()
        output = chan_out.read().decode("utf-8", "replace")
        return chan_out.channel.recv_exit_status(), output

    def put_files(self, folder: str, files: dict[str, bytes]) -> None:
        """Replaces folder (relative to the user's home) with these files."""
        assert self.client
        folders = sorted({posixpath.dirname(posixpath.join(folder, name)) for name in files} | {folder})
        code, output = self.run(f"rm -rf {shlex.quote(folder)} && mkdir -p " + " ".join(shlex.quote(f) for f in folders))
        if code != 0:
            raise SshError(f"Gagesite couldn't make the folder ~/{folder} on your server: {output.strip()[-300:]}")
        sftp = self.client.open_sftp()
        try:
            home = sftp.normalize(".")
            for name in sorted(files):
                remote = posixpath.join(home, folder, name)
                with sftp.open(remote, "wb") as handle:
                    handle.set_pipelined(True)
                    handle.write(files[name])
        finally:
            sftp.close()
