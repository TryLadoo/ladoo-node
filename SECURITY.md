# Security

Please don't report security issues in public GitHub issues.

Email **support@tryladoo.com** with "Security" in the subject. Include what you found, how to reproduce it and the version of this package you used. We'll confirm we got it and keep you updated while we fix it.

Our disclosure policy is at https://tryladoo.com/security#disclosure.

## Keeping keys safe

- Use API keys only on servers. Never put a key in a web page, a mobile app or a public repository.
- Give each integration its own key with the fewest scopes it needs.
- Always verify webhook and pre-call signatures with `ladoo/webhooks` before trusting a request.
