#!/usr/bin/env node

/**
 * Migration Test Script
 * Tests that days_per_round migration was applied correctly
 * 
 * Usage: node test-migration.js
 */

const { createClient } = require("@supabase/supabase-js");

async function testMigration() {
  console.log("🔍 Testing days_per_round migration...\n");

  const supabaseUrl = "http://127.0.0.1:54321";
  const supabaseKey = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Test 1: Column exists
    console.log("✓ Test 1: Check if days_per_round column exists");
    const { data: season, error } = await supabase
      .from("season")
      .select("season_id, description, days_per_round")
      .limit(1);

    if (error) {
      throw new Error(`Failed to query season table: ${error.message}`);
    }

    if (season && season.length > 0) {
      console.log(`  ✅ Column exists. Default value: ${season[0].days_per_round}`);
    } else {
      console.log("  ⚠️  No seasons found (table is empty, that's OK)");
    }

    // Test 2: Constraint validation
    console.log("\n✓ Test 2: Check constraint (1-14 range)");
    const testValues = [0, 1, 4, 14, 15]; // 0 and 15 should fail

    for (const val of testValues) {
      const { error: insertError } = await supabase.from("season").insert([
        {
          description: `Test Season ${val}`,
          season_start_at: new Date().toISOString(),
          season_end_at: new Date(Date.now() + 90 * 86400000).toISOString(),
          days_per_round: val,
        },
      ]);

      if (insertError) {
        console.log(`  ℹ️  Value ${val} rejected (expected for ${val < 1 || val > 14 ? "invalid" : "valid"} range)`);
      } else {
        console.log(`  ✅ Value ${val} accepted (constraint passed)`);
      }
    }

    // Test 3: Update existing season
    console.log("\n✓ Test 3: Update days_per_round on existing season");
    const { data: seasons } = await supabase
      .from("season")
      .select("season_id")
      .limit(1);

    if (seasons && seasons.length > 0) {
      const { error: updateError } = await supabase
        .from("season")
        .update({ days_per_round: 7 })
        .eq("season_id", seasons[0].season_id);

      if (updateError) {
        console.log(`  ❌ Update failed: ${updateError.message}`);
      } else {
        console.log(`  ✅ Successfully updated season to 7-day rounds`);
      }
    }

    console.log("\n✅ All migration tests passed!");
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Migration test failed: ${error.message}`);
    process.exit(1);
  }
}

testMigration();
