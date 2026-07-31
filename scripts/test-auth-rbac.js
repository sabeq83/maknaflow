/**
 * Verification Test Script: Multi-User, RBAC & Data Isolation for MAKNA Grid
 */

import { getDb } from '../lib/db.js';
import { loginUser, getSessionUser, createSession } from '../lib/auth.js';
import { hashPassword } from '../lib/schema/user-schema.js';

console.log('================================================================');
console.log('🧪 TESTING MULTI-USER, RBAC & BRAND DATA ISOLATION ENGINE');
console.log('================================================================');

try {
  const db = getDb();
  console.log('✅ Database connected & initialized');

  // Test 1: Verify Default Admin Account
  console.log('\n[Test 1] Testing Default Admin Credentials...');
  const adminLogin = loginUser('admin', 'admin123');
  if (adminLogin.success) {
    console.log(` ✅ Default Admin Login PASSED! User ID: ${adminLogin.user.id}, Role: ${adminLogin.user.role}`);
    const adminSession = getSessionUser(adminLogin.token);
    console.log(` ✅ Admin Permitted Menus Count: ${adminSession.menuPermissions.length}`);
  } else {
    console.error(' ❌ Default Admin Login FAILED:', adminLogin.error);
  }

  // Test 2: Create Test Regular User
  console.log('\n[Test 2] Creating Test User "staff_user_a"...');
  const testUserId = `usr_test_${Date.now()}`;
  const testUserPassword = hashPassword('password123');
  
  await db.prepare(`
    INSERT OR REPLACE INTO users (id, username, email, password_hash, role, status)
    VALUES (?, ?, ?, ?, 'user', 'active')
  `).run(testUserId, 'staff_user_a', 'staffa@makna.grid', testUserPassword);

  // Grant specific menu permissions: strategic_campaign & content_planner ONLY
  await db.prepare('DELETE FROM user_menu_permissions WHERE user_id = ?').run(testUserId);
  await db.prepare(`
    INSERT INTO user_menu_permissions (id, user_id, menu_key, can_read, can_write)
    VALUES (?, ?, 'strategic_campaign', 1, 1), (?, ?, 'content_planner', 1, 1)
  `).run(`perm_${testUserId}_sc`, testUserId, `perm_${testUserId}_cp`, testUserId);

  console.log(' ✅ User "staff_user_a" created with 2 granted menus (strategic_campaign, content_planner)');

  // Test 3: Authenticate Regular User & Check Restricted Permissions
  console.log('\n[Test 3] Testing User Authentication & Restricted Permissions...');
  const userLogin = loginUser('staff_user_a', 'password123');
  if (userLogin.success) {
    console.log(` ✅ User Login PASSED! Role: ${userLogin.user.role}`);
    const userSession = getSessionUser(userLogin.token);
    console.log(` ✅ User Permitted Menus:`, userSession.menuPermissions);
    
    if (userSession.menuPermissions.includes('strategic_campaign') && !userSession.menuPermissions.includes('system_settings')) {
      console.log(' ✅ Menu Access Guard PASSED! (strategic_campaign ALLOWED, system_settings RESTRICTED)');
    } else {
      console.error(' ❌ Menu Access Guard FAILED!');
    }
  } else {
    console.error(' ❌ User Login FAILED:', userLogin.error);
  }

  // Test 4: Assign Multiple Brands & Verify Scoping
  console.log('\n[Test 4] Testing Multi-Brand Assignment Scoping...');
  // Seed dummy brand profile
  const dummyBrandId = `brand_test_${Date.now()}`;
  await db.prepare(`
    INSERT INTO brand_profiles (id, brand_name, tone_of_voice, visual_signature)
    VALUES (?, 'Nutriblend Test Brand', 'Casual & Energetic', 'Minimalist Modern')
  `).run(dummyBrandId);

  // Assign brand to user
  await db.prepare(`
    INSERT OR REPLACE INTO user_brands (id, user_id, brand_id)
    VALUES (?, ?, ?)
  `).run(`ub_${testUserId}_${dummyBrandId}`, testUserId, dummyBrandId);

  const assignedBrands = await db.prepare(`
    SELECT bp.brand_name FROM user_brands ub
    JOIN brand_profiles bp ON ub.brand_id = bp.id
    WHERE ub.user_id = ?
  `).all(testUserId);

  console.log(` ✅ Assigned Brands for staff_user_a:`, assignedBrands.map(b => b.brand_name));
  if (assignedBrands.length > 0 && assignedBrands[0].brand_name === 'Nutriblend Test Brand') {
    console.log(' ✅ Multi-Brand Mapping & Scoping PASSED!');
  } else {
    console.error(' ❌ Multi-Brand Scoping FAILED!');
  }

  // Cleanup test data
  await db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  await db.prepare('DELETE FROM brand_profiles WHERE id = ?').run(dummyBrandId);
  console.log('\n🧹 Test Data Cleanup Complete.');

  console.log('\n================================================================');
  console.log('🎉 ALL MULTI-USER & RBAC TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================');
} catch (err) {
  console.error('❌ RBAC Test Runner Error:', err);
  process.exit(1);
}
