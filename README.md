# 🪣 S3 Viewer

A simple and versatile S3 viewer supporting multiple S3-compatible storage providers.  

**Supported providers:**

| Provider    | Status |
|------------|--------|
| AWS        | ✅     |
| Garage     | ✅     |
| Scaleway   | ✅     |

---

## 🚀 Get Started

### Docker image

Your have two options to get images:

- `docker.io/tchoupinax/s3-viewer:v0.2.0`
- `ghcr.io/tchoupinax/s3-viewer:v0.2.0`

### How to add a S3 API

S3 Viewer connects to multiple S3 accounts, all configured via **environment variables**. Each account is identified by a custom prefix.

All accounts the viewer can connect are declared by environment variables. The variable is composed of:
- prefix: `S3_VIEWER_ACCOUNT_`.
- name: a name choosen by you and for your usage.
- key: `_ACCESS_KEY, _REGION`...

```yaml
# 1st account
S3_VIEWER_ACCOUNT_ANALYTICS_ACCESS_KEY: <access-key>
S3_VIEWER_ACCOUNT_ANALYTICS_ENDPOINT: https://s3.fr-par.scw.cloud
S3_VIEWER_ACCOUNT_ANALYTICS_ID: my-custom-name
S3_VIEWER_ACCOUNT_ANALYTICS_NAME: Analytics
S3_VIEWER_ACCOUNT_ANALYTICS_REGION: fr-par
S3_VIEWER_ACCOUNT_ANALYTICS_SECRET_KEY: <secret-key>

# 2nd account
S3_VIEWER_ACCOUNT_BACKUP_ACCESS_KEY: <access-key>
S3_VIEWER_ACCOUNT_BACKUP_ENDPOINT: https://s3.fr-par.scw.cloud
S3_VIEWER_ACCOUNT_BACKUP_ID: my-custom-name-2
S3_VIEWER_ACCOUNT_BACKUP_NAME: BACKUP
S3_VIEWER_ACCOUNT_BACKUP_REGION: fr-par
S3_VIEWER_ACCOUNT_BACKUP_SECRET_KEY: <secret-key>
```
