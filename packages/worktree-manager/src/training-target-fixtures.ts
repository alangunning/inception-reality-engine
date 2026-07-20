export const VAMPI_AUTHORIZATION_REGRESSION_TEST = `from __future__ import annotations

import ast
import json
import types
import unittest
import warnings
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class Response:
    def __init__(self, body, status, mimetype=None):
        self.body = body
        self.status_code = status
        self.mimetype = mimetype


class Query:
    def __init__(self, records):
        self.records = records
        self.filters = {}

    def filter_by(self, **filters):
        query = Query(self.records)
        query.filters = filters
        return query

    def first(self):
        for record in self.records:
            if all(getattr(record, key, None) == value for key, value in self.filters.items()):
                return record
        return None


def load_function(relative_path, function_name, namespace):
    source = (ROOT / relative_path).read_text(encoding="utf8")
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", SyntaxWarning)
        module = ast.parse(source, filename=relative_path)
    function = next(
        node
        for node in module.body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        and node.name == function_name
    )
    isolated = ast.fix_missing_locations(ast.Module(body=[function], type_ignores=[]))
    exec(compile(isolated, relative_path, "exec"), namespace)
    return namespace[function_name]


class AuthorizationRegressionTest(unittest.TestCase):
    def setUp(self):
        self.alice = types.SimpleNamespace(
            id=1,
            username="alice",
            admin=False,
        )
        self.admin = types.SimpleNamespace(
            id=2,
            username="admin",
            admin=True,
        )
        self.alice_book = types.SimpleNamespace(
            book_title="alice-title",
            secret_content="alice-secret",
            user=self.alice,
            user_id=self.alice.id,
        )
        self.admin_book = types.SimpleNamespace(
            book_title="shared-title",
            secret_content="admin-secret",
            user=self.admin,
            user_id=self.admin.id,
        )

    def book_handler(self):
        users = [self.alice, self.admin]
        books = [self.alice_book, self.admin_book]

        class User:
            query = Query(users)

        class Book:
            query = Query(books)

            @staticmethod
            def get_by_owner_and_title(user, book_title):
                return Query(books).filter_by(user=user, book_title=book_title).first()

        namespace = {
            "Book": Book,
            "Response": Response,
            "User": User,
            "error_message_helper": lambda message: json.dumps({
                "status": "fail",
                "message": message,
            }),
            "json": json,
            "request": types.SimpleNamespace(headers={
                "Authorization": "Bearer synthetic-alice-token",
            }),
            "str": str,
            "token_validator": lambda _header: {"sub": "alice"},
            "vuln": True,
        }
        return load_function("api_views/books.py", "get_by_title", namespace)

    def test_an_owner_can_read_their_own_book(self):
        response = self.book_handler()("alice-title")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(json.loads(response.body), {
            "book_title": "alice-title",
            "secret": "alice-secret",
            "owner": "alice",
        })

    def test_another_owners_secret_is_not_returned(self):
        response = self.book_handler()("shared-title")
        self.assertEqual(response.status_code, 404)
        self.assertNotIn("admin-secret", response.body)

    def delete_handler(self, subject, deleted):
        users = [self.alice, self.admin]

        class User:
            query = Query(users)

            @staticmethod
            def delete_user(username):
                deleted.append(username)
                return True

        namespace = {
            "Response": Response,
            "User": User,
            "error_message_helper": lambda message: json.dumps({
                "status": "fail",
                "message": message,
            }),
            "json": json,
            "request": types.SimpleNamespace(headers={
                "Authorization": f"Bearer synthetic-{subject}-token",
            }),
            "token_validator": lambda _header: {"sub": subject},
        }
        return load_function("api_views/users.py", "delete_user", namespace)

    def test_a_non_admin_cannot_delete_a_user(self):
        deleted = []
        response = self.delete_handler("alice", deleted)("admin")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(deleted, [])

    def test_an_admin_can_delete_a_user(self):
        deleted = []
        response = self.delete_handler("admin", deleted)("alice")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(deleted, ["alice"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
`;

export const VAMPI_REALITY_REQUIREMENTS = `attrs==24.3.0
certifi==2025.1.31
charset-normalizer==3.4.1
click==8.1.8
clickclick==20.10.2
connexion[swagger-ui]==2.14.2
Flask-SQLAlchemy==3.0.3
Flask==2.2.2
greenlet==3.1.1
idna==3.10
inflection==0.5.1
itsdangerous==2.2.0
Jinja2==3.1.6
jsonschema==4.17.3
MarkupSafe==2.1.5
packaging==24.2
PyJWT==2.6.0
pyrsistent==0.20.0
PyYAML==6.0.2
requests==2.32.3
SQLAlchemy==2.0.2
swagger-ui-bundle==0.0.9
typing_extensions==4.12.2
urllib3==1.26.20
Werkzeug==2.2.3
`;

export const VAMPI_AUTHORIZATION_PROOF_RUNNER = `#!/bin/sh
set -eu

if [ -x .venv/bin/python ]; then
  exec .venv/bin/python tests/test_authorization_regression.py
fi

if command -v python3 >/dev/null 2>&1; then
  exec python3 tests/test_authorization_regression.py
fi

exec python tests/test_authorization_regression.py
`;
