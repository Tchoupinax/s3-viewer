import { expect, test } from "@playwright/test";

test.describe("S3 Viewer k3d integration", () => {
  test("home page lists the MinIO backups bucket", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "S3 Viewer" })).toBeVisible();
    await expect(page.getByText("Loading buckets…")).toBeHidden({ timeout: 30_000 });

    const bucketButton = page.getByRole("button", { name: /backups/i });
    await expect(bucketButton).toBeVisible();
    await expect(bucketButton).toContainText("aluminium");
    await expect(bucketButton).toContainText("3 files");
  });

  test("bucket documents show MinIO seed data", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Loading buckets…")).toBeHidden({ timeout: 30_000 });
    await page.getByRole("button", { name: /backups/i }).click();

    await expect(page.getByText("Loading documents…")).toBeHidden({ timeout: 30_000 });
    await expect(page.getByText("manifest.json")).toBeVisible();
    await expect(page.getByText("backup-001.sql.gz")).toBeVisible();
    await expect(page.getByText("backup-002.sql.gz")).toBeVisible();
  });
});
