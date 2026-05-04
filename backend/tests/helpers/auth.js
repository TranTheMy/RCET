/**
 * Auth helpers for integration tests.
 * Returns a supertest agent with Authorization header pre-set.
 */
const request = require('supertest');
const app = require('../../src/app');

/**
 * Log in with the given credentials and return the access token.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<string>} JWT access token
 */
async function getToken(email, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);

  return res.body.data.tokens.accessToken;
}

/**
 * Return an authenticated supertest wrapper function.
 * Usage:
 *   const agent = await makeAgent('admin@lab.com', 'Admin123!');
 *   const res = await agent('get', '/api/projects');
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<(method: string, url: string) => import('supertest').Test>}
 */
async function makeAgent(email, password) {
  const token = await getToken(email, password);
  return (method, url) =>
    request(app)[method](url).set('Authorization', `Bearer ${token}`);
}

module.exports = { getToken, makeAgent };
