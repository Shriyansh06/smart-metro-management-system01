import { test, expect } from "@playwright/test";

test("passenger, disruptions, boarding, crowd analytics and mobile workflows", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your city. One seamless journey." }),
  ).toBeVisible();
  await page.getByLabel("FROM station search", {exact:true}).fill("ce");
  await page.getByRole("button", {name:"Central",exact:true}).click();
  await page.getByRole("button", { name: "Find my route" }).click();
  await expect(
    page.getByText("Central to Airport", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign in to book" }).click();
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Find my route" }).click();
  await page.getByRole("button", { name: "Book journey" }).click();
  await page.getByRole("button", { name: "My bookings" }).click();
  await expect(
    page.getByText("Current route is available.").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("button", { name: "Administrator", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.getByText("Trains running", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Disruptions", exact: true }).click();
  await page
    .getByLabel("Description", { exact: true })
    .fill("Browser test signal fault");
  await page.getByRole("button", { name: "Report & reroute" }).click();
  await expect(
    page.getByRole("heading", { name: "Browser test signal fault" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Plan a journey" }).click();
  await page.getByRole("button", { name: "Find my route" }).click();
  await expect(
    page.locator(".route-stops").getByText("Old Town", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".route-stops").getByText("University", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Passenger queues" }).click();
  await page.getByRole("button", { name: "Simulate arrivals" }).click();
  await expect(page.locator(".queue-total")).toContainText("13 waiting");
  await page.getByRole("button", { name: "Board passengers" }).click();
  await expect(
    page.getByText("13 / 80 passengers onboard", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Alight all" }).click();
  await expect(
    page.getByText("0 / 80 passengers onboard", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Disruptions", exact: true }).click();
  await page.getByRole("button", { name: "Resolve incident" }).click();
  await expect(page.getByText("P3 · resolved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Daily passenger crowd" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Hourly passenger arrivals; daily total 13",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("All available stations are connected."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Algorithm lab" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Plan a journey" }).click();
  const dismiss = page.getByRole("button", { name: "Dismiss notification" });
  if (await dismiss.isVisible()) await dismiss.click();
  await page.screenshot({
    path: process.env.METRO_SCREENSHOT || "test-results/desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Find my route" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
