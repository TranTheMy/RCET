const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { v4: uuidv4 } = require('uuid');
const { User, sequelize } = require('../models');
const env = require('./env');
const { USER_STATUS, SYSTEM_ROLES } = require('./constants');

passport.use(
  new GoogleStrategy(
    {
      clientID: env.google.clientId,
      clientSecret: env.google.clientSecret,
      callbackURL: env.google.callbackUrl,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('No email from Google profile'));
        }

        let user = await User.findOne({ where: { email } });

        if (user) {
          // User exists
          if (user.status === USER_STATUS.PENDING) {
            return done(null, user, { message: 'Account pending approval' });
          }
          if (user.status === USER_STATUS.REJECTED) {
            return done(null, false, { message: 'Account rejected' });
          }
          if (user.status === USER_STATUS.LOCKED) {
            return done(null, false, { message: 'Account locked' });
          }
          return done(null, user);
        }

        // Create new user (Google-registered users start as PENDING)
        const userId = uuidv4();
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        // Use raw SQL to avoid Sequelize date issues
        await sequelize.query(
          `INSERT INTO [Users] ([id], [full_name], [email], [password_hash], [system_role], [status], [email_verified], [created_at], [updated_at])
           VALUES (?, ?, ?, ?, ?, ?, ?, CONVERT(DATETIME, ?), CONVERT(DATETIME, ?))`,
          {
            replacements: [
              userId,
              profile.displayName || `User ${profile.id}`,
              email,
              'google-oauth',
              null,
              USER_STATUS.PENDING,
              1,
              now,
              now,
            ],
          },
        );

        // Fetch the created user
        user = await User.findByPk(userId);
        return done(null, user, { message: 'New user created, pending approval' });
      } catch (error) {
        return done(error);
      }
    },
  ),
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

module.exports = passport;
