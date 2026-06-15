import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

// ====== Delete Firebase Auth User ======
export const deleteAuthUser = functions.https.onCall(async (data, context) => {
  // Check if caller is authenticated and is admin
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول أولاً');
  }

  // Verify caller is platform admin
  const callerToken = context.auth.token;
  if (callerToken.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'غير مصرح — يجب أن تكون مدير عام');
  }

  const { email } = data;
  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'يرجى إرسال البريد الإلكتروني');
  }

  try {
    // Find user by email (v2 - storage permission fixed)
    const userRecord = await admin.auth().getUserByEmail(email);
    
    // Delete the user from Firebase Auth
    await admin.auth().deleteUser(userRecord.uid);
    
    return { success: true, message: `تم حذف المستخدم ${email}` };
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      // User doesn't exist in Auth — that's fine
      return { success: true, message: 'المستخدم غير موجود في Firebase Auth' };
    }
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ====== List Auth Users (for debugging) ======
export const listAuthUsers = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  }

  const callerToken = context.auth.token;
  if (callerToken.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'غير مصرح');
  }

  try {
    const listUsersResult = await admin.auth().listUsers();
    const users = listUsersResult.users.map(userRecord => ({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
    }));
    return { users };
  } catch (error: any) {
    throw new functions.https.HttpsError('internal', error.message);
  }
});
