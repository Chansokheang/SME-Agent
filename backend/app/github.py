"""Saves the generated website (site/) to the owner's own GitHub repository.

The owner gives a repository ("owner/name") and a token that can write to it. The token is
stored encrypted (secrets_store) and is passed to git only through environment variables,
never on a command line, in .git/config or in a log.
"""

import base64
import json
import os
import shutil
import subprocess
import urllib.error
import urllib.request
from pathlib import Path

API = "https://api.github.com"
AUTHOR = ("Gagesite", "gagesite@users.noreply.github.com")


class GitHubError(Exception):
    """A plain-language reason the connection or the push failed."""


def _api(method: str, path: str, token: str, body: dict | None = None) -> dict:
    request = urllib.request.Request(
        API + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "Gagesite",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)


def normalize_repo(value: str) -> str:
    """"https://github.com/me/site(.git)" or "me/site" -> "me/site"."""
    repo = value.strip().removesuffix(".git").rstrip("/")
    repo = repo.split("github.com/")[-1]
    parts = [p for p in repo.split("/") if p]
    if len(parts) != 2:
        raise GitHubError('Give the repository as "your-name/repository-name" or its GitHub address.')
    return "/".join(parts)


def connect(repo: str, token: str) -> dict:
    """Checks the token can write to the repository, creating it (private) when it doesn't exist yet."""
    repo = normalize_repo(repo)
    try:
        info = _api("GET", f"/repos/{repo}", token)
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            raise GitHubError("GitHub didn't accept that token. Check it was copied completely and hasn't expired.") from None
        if exc.code != 404:
            raise GitHubError(f"GitHub answered with an error ({exc.code}). Try again in a moment.") from None
        info = _create(repo, token)
    except urllib.error.URLError:
        raise GitHubError("GitHub couldn't be reached. Check the internet connection.") from None
    if not (info.get("permissions") or {}).get("push"):
        raise GitHubError("That token can read the repository but not save to it. Give it write access (Contents: Read and write).")
    return {"repo": info["full_name"], "url": info["html_url"], "private": info.get("private", True)}


def _create(repo: str, token: str) -> dict:
    owner, name = repo.split("/")
    try:
        me = _api("GET", "/user", token)
        path = "/user/repos" if me.get("login", "").lower() == owner.lower() else f"/orgs/{owner}/repos"
        return _api("POST", path, token, {"name": name, "private": True, "description": "Website built with Gagesite"})
    except urllib.error.HTTPError:
        raise GitHubError(
            f"The repository {repo} doesn't exist, and this token can't create it. "
            "Create an empty repository with that name on GitHub first, then connect again."
        ) from None


def _git(site: Path, *args: str, token: str | None = None) -> subprocess.CompletedProcess:
    env = {**os.environ, "GIT_TERMINAL_PROMPT": "0"}
    if token:
        basic = base64.b64encode(f"x-access-token:{token}".encode()).decode()
        env.update({
            "GIT_CONFIG_COUNT": "1",
            "GIT_CONFIG_KEY_0": "http.https://github.com/.extraheader",
            "GIT_CONFIG_VALUE_0": f"AUTHORIZATION: basic {basic}",
        })
    return subprocess.run([shutil.which("git") or "git", *args], cwd=site, env=env, capture_output=True,
                          text=True, encoding="utf-8", errors="replace", timeout=180)


def push(site: Path, repo: str, token: str, message: str) -> dict:
    """Commits everything in site/ (minus .gitignore'd files) and pushes it to the repository's main branch."""
    if not ((site / "package.json").exists() or (site / "requirements.txt").exists()):
        raise GitHubError("There is no website to save yet.")
    if not (site / ".git").is_dir():
        _git(site, "init", "-b", "main")
    _git(site, "config", "user.name", AUTHOR[0])
    _git(site, "config", "user.email", AUTHOR[1])
    _git(site, "add", "-A")
    committed = _git(site, "commit", "-m", message)
    if committed.returncode != 0 and "nothing to commit" not in committed.stdout + committed.stderr:
        if "does not have any commits" not in committed.stderr:
            raise GitHubError("The changes couldn't be prepared for saving.")
    sent = _git(site, "push", f"https://github.com/{repo}.git", "HEAD:main", token=token)
    if sent.returncode != 0:
        output = sent.stderr.lower()
        if "rejected" in output or "fetch first" in output or "non-fast-forward" in output:
            raise GitHubError(
                "The repository already has changes that aren't from Gagesite. Use an empty repository, "
                "or bring those changes into this project first."
            )
        if "403" in output or "permission" in output:
            raise GitHubError("GitHub refused the save: the token needs write access to this repository.")
        raise GitHubError("Saving to GitHub failed. Try again in a moment.")
    head = _git(site, "rev-parse", "--short", "HEAD").stdout.strip()
    return {"commit": head}
