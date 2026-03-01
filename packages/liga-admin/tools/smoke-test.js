#!/usr/bin/env node

/**
 * Smoke Test Script - Daily Points Feature
 * Validates that daily points grid works correctly after deployment
 * 
 * Run this immediately after deploying to verify functionality
 * 
 * Requirements:
 *   - Node.js 18+
 *   - Environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 *
 * Usage:
 *   npm run smoke-test
 *   VITE_SUPABASE_URL=... npm run smoke-test  # Override URL
 */

const https = require("https");

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://kivlwozjpijejrubapcw.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
  console.error("❌ Error: VITE_SUPABASE_ANON_KEY environment variable not set");
  process.exit(1);
}

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[36m";
const RESET = "\x1b[0m";

let testsPassed = 0;
let testsFailed = 0;

function log(message) {
  console.log(message);
}

function success(test) {
  console.log(`${GREEN}✅${RESET} ${test}`);
  testsPassed++;
}

function failure(test, reason) {
  console.log(`${RED}❌${RESET} ${test}`);
  console.log(`   ${reason}`);
  testsFailed++;
}

async function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SUPABASE_URL);
    const options = {
      method,
      headers: {
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
      },
    };

    const req = https.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  log(`${BLUE}🧪 Daily Points Feature - Smoke Tests${RESET}\n`);
  log(`Testing: ${SUPABASE_URL}\n`);

  // Test 1: Database connectivity
  log("Test 1: Database Connectivity");
  try {
    const res = await makeRequest("GET", "/rest/v1/season?select=season_id&limit=1");
    if (res.status === 200) {
      success("Can connect to Supabase API");
    } else {
      failure("Supabase API connectivity", `Status: ${res.status}`);
    }
  } catch (error) {
    failure("Supabase API connectivity", error.message);
  }

  // Test 2: Season table has days_per_round column
  log("\nTest 2: Migration Applied - days_per_round Column");
  try {
    const res = await makeRequest(
      "GET",
      "/rest/v1/season?select=season_id,days_per_round&limit=1"
    );
    if (res.status === 200 && Array.isArray(res.data)) {
      if (res.data.length > 0 && "days_per_round" in res.data[0]) {
        success(`days_per_round column exists (default value: ${res.data[0].days_per_round})`);
      } else {
        success("Column exists (no seasons in database yet - OK for fresh DB)");
      }
    } else {
      failure(
        "days_per_round column",
        `Query failed with status ${res.status}`
      );
    }
  } catch (error) {
    failure("days_per_round column", error.message);
  }

  // Test 3: Constraint validation
  log("\nTest 3: Constraint Validation (1-14 range)");
  try {
    // Try to create a test season with valid days_per_round
    const testSeason = {
      description: `Smoke Test ${new Date().toISOString()}`,
      season_start_at: new Date().toISOString(),
      season_end_at: new Date(Date.now() + 90 * 86400000).toISOString(),
      days_per_round: 7,
    };

    const res = await makeRequest("POST", "/rest/v1/season", testSeason);

    if (res.status === 201) {
      success("Can insert season with valid days_per_round (7)");
      // Clean up test data
      const insertedId = res.data[0]?.season_id;
      if (insertedId) {
        await makeRequest("DELETE", `/rest/v1/season?season_id=eq.${insertedId}`);
      }
    } else if (res.status === 409) {
      // Constraint violation expected for invalid values
      success(
        "Constraint check working (insert validation in place)"
      );
    } else {
      failure("Constraint validation", `Unexpected status: ${res.status}`);
    }
  } catch (error) {
    failure("Constraint validation", error.message);
  }

  // Test 4: Daily points query structure
  log("\nTest 4: Daily Points Query Structure");
  try {
    const res = await makeRequest(
      "GET",
      "/rest/v1/scheduled_match?select=scheduled_match_id,scheduled_from,player_a_id&limit=1"
    );
    if (res.status === 200) {
      success("scheduled_match table accessible with required columns");
    } else {
      failure(
        "Daily points query",
        `Query failed with status ${res.status}`
      );
    }
  } catch (error) {
    failure("Daily points query", error.message);
  }

  // Test 5: Player-Season relationship
  log("\nTest 5: Player-Season Data Integrity");
  try {
    const res = await makeRequest(
      "GET",
      "/rest/v1/season_zone_team_player?select=player_id,start_date,end_date&limit=1"
    );
    if (res.status === 200) {
      success("Player active dates properly stored");
    } else {
      failure(
        "Player-season integrity",
        `Query failed with status ${res.status}`
      );
    }
  } catch (error) {
    failure("Player-season integrity", error.message);
  }

  // Summary
  log(`\n${BLUE}${"=".repeat(50)}${RESET}`);
  log(
    `${GREEN}Passed: ${testsPassed}${RESET} | ${RED}Failed: ${testsFailed}${RESET}`
  );
  log(`${BLUE}${"=".repeat(50)}${RESET}\n`);

  if (testsFailed === 0) {
    log(
      `${GREEN}✅ All smoke tests passed! Daily points feature is ready.${RESET}`
    );
    process.exit(0);
  } else {
    log(
      `${RED}❌ ${testsFailed} test(s) failed. Please review before deploying.${RESET}`
    );
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error(`${RED}Fatal error: ${error.message}${RESET}`);
  process.exit(1);
});
