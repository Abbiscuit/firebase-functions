const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// auth trigger (new user signup)
exports.newUserSignup = functions
  .region('asia-northeast1')
  .auth.user()
  .onCreate(user => {
    // for background triggers you must return a value/promise
    return admin
      .firestore()
      .collection('users')
      .doc(user.uid)
      .set({
        email: user.email,
        upvotedOn: []
      });
  });

// auth trigger (user deleted)
exports.userDeleted = functions
  .region('asia-northeast1')
  .auth.user()
  .onDelete(user => {
    const doc = admin
      .firestore()
      .collection('users')
      .doc(user.uid);
    return doc.delete();
  });

// http callable functions (adding a request)
exports.addRequest = functions
  .region('asia-northeast1')
  .https.onCall((data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'only authenticated users can add requests'
      );
    }
    if (data.text.length > 30) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'request must be no more than 30 characters long'
      );
    }

    const text = data.text;

    return admin
      .firestore()
      .collection('requests')
      .add({
        text,
        upvotes: 0
      });
  });

// upvote callable function
exports.upvote = functions
  .region('asia-northeast1')
  .https.onCall((data, context) => {
    // check auth state
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'only authenticated users can add requests'
      );
    }

    // get refs for user doc & req doc
    const user = admin
      .firestore()
      .collection('users')
      .doc(context.auth.uid);

    const request = admin
      .firestore()
      .collection('requests')
      .doc(data.id);

    return user.get().then(doc => {
      // check user hasn't already upvoted the request
      if (doc.data().upvotedOn.includes(data.id)) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'You can only upvote something once'
        );
      }

      // update user array
      return user
        .update({
          upvotedOn: [...doc.data().upvotedOn, data.id]
        })
        .then(() => {
          // update votes on the request
          return request.update({
            upvotes: admin.firestore.FieldValue.increment(1)
          });
        });
    });
  });
