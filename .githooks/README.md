# Pre-commit Security Hook Setup

This repository includes a security pre-commit hook to prevent accidental commits of sensitive data.

## How to Enable

Add this line to your global or repository git config:

```bash
git config core.hooksPath .githooks
```

The hook will run automatically on every commit, scanning staged files for patterns commonly associated with API keys, tokens, and other secrets.

## Blocked Patterns

- OpenRouter keys: sk-or-v1-[a-f0-9]{20,}
- JWT tokens: eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}
- Google AI Studio keys: AIza[A-Za-z0-9_-]{30,}
- AWS access keys: AKIA[0-9A-Z]{16}
- GitHub tokens: ghp_[A-Za-z0-9]{30,}

## After Commit, Always

If you need to commit a temporary secret (for testing only):
1. Use `git commit --allow-nofactories` bypass (not recommended)
2. Manually scrub the file before pushing
3. Or use `git commit --no-verify` and review the change
4. Follow your incident response procedure

## Security Notes

- This is a first line of defense, not foolproof
- Always review committed changes, especially before push
- Report suspected security issues to the security team
- Secrets may still be present in git history

## Добавление additional patterns

Если вам нужно заблокировать дополнительные паттерны для секретных данных, отредактируйте файл `.githooks/pre-commit`.
Все удаляющие паттерны должны быть зарегистрированы под создающим описанием.
