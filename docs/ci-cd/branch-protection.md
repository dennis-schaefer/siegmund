# Branch Protection: main

## Applied settings

| Setting | Value |
|---------|-------|
| Required PR | yes |
| Required status check | `all-green` |
| Strict (branch must be up to date) | yes |
| Enforce for admins | yes |
| Required reviewers | 0 |

## Reproduce

```bash
gh api \
  --method PUT \
  repos/dennis-schaefer/siegmund/branches/main/protection \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["all-green"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false
  },
  "restrictions": null
}
EOF
```

## Verify

```bash
gh api repos/dennis-schaefer/siegmund/branches/main/protection \
  --jq '{required_checks: .required_status_checks.contexts, strict: .required_status_checks.strict, enforce_admins: .enforce_admins.enabled, pr_required: (.required_pull_request_reviews != null)}'
```
