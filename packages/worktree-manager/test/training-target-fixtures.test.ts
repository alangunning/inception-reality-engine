import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  VAMPI_AUTHORIZATION_PROOF_RUNNER,
  VAMPI_AUTHORIZATION_REGRESSION_TEST,
  VAMPI_REALITY_REQUIREMENTS
} from "../src/training-target-fixtures";

const vulnerableBookHandler = `def get_by_title(book_title):
    resp = token_validator(request.headers.get('Authorization'))
    if "error" in resp:
        return Response(error_message_helper(resp), 401, mimetype="application/json")
    if vuln:
        book = Book.query.filter_by(book_title=str(book_title)).first()
    else:
        user = User.query.filter_by(username=resp['sub']).first()
        book = Book.query.filter_by(user=user, book_title=str(book_title)).first()
    if book:
        return Response(json.dumps({
            'book_title': book.book_title,
            'secret': book.secret_content,
            'owner': book.user.username
        }), 200, mimetype="application/json")
    return Response(error_message_helper("Book not found!"), 404, mimetype="application/json")
`;

const fixedBookHandler = vulnerableBookHandler.replace(
  "book = Book.query.filter_by(book_title=str(book_title)).first()",
  "user = User.query.filter_by(username=resp['sub']).first()\n"
    + "        book = Book.query.filter_by(user=user, book_title=str(book_title)).first()"
);

const userDeletionHandler = `def delete_user(username):
    resp = token_validator(request.headers.get('Authorization'))
    if "error" in resp:
        return Response(error_message_helper(resp), 401, mimetype="application/json")
    user = User.query.filter_by(username=resp['sub']).first()
    if user.admin:
        if bool(User.delete_user(username)):
            return Response(json.dumps({
                'status': 'success',
                'message': 'User deleted.'
            }), 200, mimetype="application/json")
        return Response(error_message_helper("User not found!"), 404, mimetype="application/json")
    return Response(error_message_helper("Only Admins may delete users!"), 401, mimetype="application/json")
`;

function runProof(repositoryPath: string) {
  const executable = ["python3", "python"].find((candidate) => {
    const version = spawnSync(candidate, ["--version"], { encoding: "utf8" });
    return version.status === 0
      && /Python 3\./.test(`${version.stdout ?? ""}\n${version.stderr ?? ""}`);
  });
  if (!executable) {
    throw new Error("The VAmPI fixture test requires Python 3 exposed as python3 or python.");
  }
  return spawnSync(executable, ["tests/test_authorization_regression.py"], {
    cwd: repositoryPath,
    encoding: "utf8"
  });
}

describe("VAmPI training fixture", () => {
  it("ships an exact framework manifest and a proof runner scoped to the Reality venv", () => {
    const requirements = VAMPI_REALITY_REQUIREMENTS
      .trim()
      .split("\n");
    expect(requirements.length).toBeGreaterThan(20);
    expect(requirements).toContain("connexion[swagger-ui]==2.14.2");
    expect(requirements).toContain("Flask-SQLAlchemy==3.0.3");
    expect(requirements).toContain("SQLAlchemy==2.0.2");
    expect(requirements.every((requirement) =>
      /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\[[A-Za-z0-9_,.-]+\])?==[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(requirement)
    )).toBe(true);
    expect(VAMPI_AUTHORIZATION_PROOF_RUNNER).toContain(".venv/bin/python");
    expect(VAMPI_AUTHORIZATION_PROOF_RUNNER).toContain("command -v python3");
    expect(VAMPI_AUTHORIZATION_PROOF_RUNNER).toContain("exec python tests/");
  });

  it("fails only the ownership proof before the fix and passes after it", async () => {
    const repositoryPath = await mkdtemp(path.join(os.tmpdir(), "inception-vampi-proof-"));
    try {
      await mkdir(path.join(repositoryPath, "api_views"), { recursive: true });
      await mkdir(path.join(repositoryPath, "tests"), { recursive: true });
      await writeFile(
        path.join(repositoryPath, "api_views/books.py"),
        vulnerableBookHandler
      );
      await writeFile(
        path.join(repositoryPath, "api_views/users.py"),
        userDeletionHandler
      );
      await writeFile(
        path.join(repositoryPath, "tests/test_authorization_regression.py"),
        VAMPI_AUTHORIZATION_REGRESSION_TEST
      );

      const vulnerable = runProof(repositoryPath);
      expect(vulnerable.status).toBe(1);
      expect(vulnerable.stderr).toContain("test_another_owners_secret_is_not_returned");
      expect(vulnerable.stderr).toContain("FAILED (failures=1)");

      await writeFile(path.join(repositoryPath, "api_views/books.py"), fixedBookHandler);
      const corrected = runProof(repositoryPath);
      expect(corrected.status).toBe(0);
      expect(corrected.stderr).toContain("Ran 4 tests");
      expect(corrected.stderr).toContain("OK");
    } finally {
      await rm(repositoryPath, { recursive: true, force: true });
    }
  });
});
