import { test, expect } from "@playwright/test";

const TEST_ROOM_CODE = "TEST123";

test.describe("JamGuessr E2E", () => {
  test("complete game flow - join room, play two games in a row", async ({ page }) => {
    // 1. Go directly to room page (skip OAuth)
    await page.goto(`/room/${TEST_ROOM_CODE}`);

    // 2. Enter username to join room
    const usernameInput = page.getByPlaceholder(/username/i);
    await expect(usernameInput).toBeVisible();
    await usernameInput.fill("TestPlayer");

    const joinBtn = page.getByRole("button", { name: /join/i });
    await expect(joinBtn).toBeVisible();
    await joinBtn.click();

    // 3. Wait for room page to load
    await expect(page.locator("text=Game Room")).toBeVisible();
    await expect(page.locator(`text=${TEST_ROOM_CODE}`)).toBeVisible();

    // 4. Open playlist modal
    const playlistBtn = page.getByText("Select Playlist").first();
    await expect(playlistBtn).toBeVisible();
    await playlistBtn.click();

    // 5. Import playlist from Spotify link
    const spotifyInput = page.getByPlaceholder(/spotify/i);
    await expect(spotifyInput).toBeVisible();
    await spotifyInput.fill(
      "https://open.spotify.com/playlist/3CoDoz8IKGn2uNTJJeVaSf?si=4b9a9e20216a4da8",
    );

    const importBtn = page.getByRole("button", { name: /import/i });
    await importBtn.click();

    // 6. Dismiss the "Add to Library?" dialog if it appears
    const libraryDialog = page.getByRole("dialog", { name: /add to library/i });
    await libraryDialog.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
    if (await libraryDialog.isVisible()) {
      await page.getByRole("button", { name: /skip/i }).first().click();
    }

    // 7. Verify Select Playlist text is updated to show playlist name
    await expect(
      page.getByText("very vulnerable rn if any goth girl would like to take advantage of me"),
    ).toBeVisible();

    // 8. Open settings modal to set quick game settings
    const settingsBtn = page.getByText("Settings").first();
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();

    // Click on 5 rounds (first button in the rounds section)
    await page.locator("button:has-text('5')").first().click();

    // Click on 5s time per round (first button in the time section)
    await page.locator("button:has-text('5s')").first().click();

    // Save settings
    const saveSettingsBtn = page.getByRole("button", { name: /save/i });
    await saveSettingsBtn.click();

    // 9. Set up audio request tracking before starting the game
    const uniqueAudioPreviews = new Set<string>();
    page.on("request", (request) => {
      if (request.url().includes("p.scdn.co/mp3-preview")) {
        uniqueAudioPreviews.add(request.url());
      }
    });

    // 10. Click Start Game button (host)
    const startGameBtn = page.getByRole("button", { name: /start game/i });
    await expect(startGameBtn).toBeVisible();
    await startGameBtn.click();

    // Loop to play two games
    for (let game = 1; game <= 2; game++) {
      console.log(`--- Starting game ${game} ---`);
      let previousScore = 0;

      for (let round = 1; round <= 5; round++) {
        await expect(page.locator(`text=Round ${round}`)).toBeVisible({ timeout: 10000 });

        // Verify a unique audio preview URL was fetched for this round
        await expect
          .poll(() => uniqueAudioPreviews.size, {
            timeout: 15000,
            message: `Expected unique audio preview URL for round ${round}`,
          })
          .toBe(round + (game - 1) * 5);

        // Click the first answer button (contains number "1")
        const firstOption = page.locator("button:has-text('1')").first();
        await expect(firstOption).toBeVisible({ timeout: 10000 });
        await firstOption.click();

        if (round < 5) {
          // Wait for next round transition implicitly
          await expect(page.locator("text=Round Complete")).toBeVisible({ timeout: 10000 });
        } else {
          // Last round
          await expect(page.locator("text=Game Over")).toBeVisible({ timeout: 10000 });
          await expect(page.locator("text=Final Standings")).toBeVisible();
        }

        // Look for the actual score in the score display (green colored text)
        const greenScoreElement = page.locator("p.text-green-400").first();
        let currentScore = 0;
        if (await greenScoreElement.isVisible()) {
          const scoreText = await greenScoreElement.textContent();
          currentScore = scoreText ? parseInt(scoreText.replace(/\D/g, "")) : 0;
        }

        if (currentScore > previousScore) {
          console.log(`Round ${round}: CORRECT! Score: ${previousScore} → ${currentScore}`);
        } else {
          console.log(`Round ${round}: Wrong answer. Score: ${currentScore}`);
        }
        previousScore = currentScore;
      }
      // Vote for next game
      if (game === 1) {
        const yesBtn = page.getByRole("button", { name: "Yes" });
        await expect(yesBtn).toBeVisible();
        await yesBtn.click();
      } else {
        // Vote No for second game
        const noBtn = page.getByRole("button", { name: "No" });
        await expect(noBtn).toBeVisible();
        await noBtn.click();
      }
    }

    // Verify back to lobby state
    await expect(page.locator("text=Game Room")).toBeVisible();
    await expect(page.locator("text=Players")).toBeVisible();
    await expect(page.getByRole("button", { name: /start game/i })).toBeVisible();
  });
});
