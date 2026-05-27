import { describe, it, expect } from 'vitest';
import { Jwt } from './jwt';

const delay = async (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
describe('helpers jwt test', () => {
  const jwt1 = Jwt.initial('secret1');
  const jwt2 = Jwt.initial('secret2');

  describe('verifyToken', () => {
    const payload1 = { id: 1 };
    const expiredToken = jwt1.createToken(payload1, { expiresIn: 1 });
    const token1 = jwt1.createToken({ id: 1 });
    describe('jwt1 verify token1', () => {
      it('set same subject return success true', () => {
        const tokenSubject = jwt1.createToken({ id: 1 }, { subject: 'test' });
        const result = jwt1.verifyToken(tokenSubject, { subject: 'test' });
        expect(result.success).toBeTruthy();
      });
      it('set deference subject return success false', () => {
        const tokenSubject = jwt1.createToken({ id: 1 }, { subject: 'test' });
        const result = jwt1.verifyToken(tokenSubject, { subject: 'test2' });
        expect(result.success).toBeFalsy();
        expect(result.err).toHaveProperty('name', 'JsonWebTokenError');
        expect(result.errMsg).toContain('jwt subject invalid');
        expect(result.errMsg).toContain('expected: test2');
      });

      it('unexpired token should return success true', () => {
        const result = jwt1.verifyToken(expiredToken);
        expect(result.success).toBeTruthy();
      });

      it('expired token should return success false', async () => {
        await delay(1200);
        const result = jwt1.verifyToken(expiredToken);
        expect(result.success).toBeFalsy();
      });
      it('expired token should return err property TokenExpiredError', async () => {
        await delay(1200);
        const result = jwt1.verifyToken(expiredToken);
        expect(result.err).toHaveProperty('name', 'TokenExpiredError');
      });

      it('should return success true', () => {
        const result = jwt1.verifyToken(token1);
        expect(result.success).toBeTruthy();
      });
    });

    describe('jwt2 verify token1', () => {
      it('jwt2 should return success false', () => {
        const result = jwt2.verifyToken(expiredToken);
        expect(result.success).toBeFalsy();
      });
      it('jwt2 should return jwt1 payload', () => {
        const result = jwt2.verifyToken(expiredToken);
        expect(result.payload).toMatchObject(payload1);
      });
    });
  });

  describe('decodeToken', () => {
    it('jwt1 outer token, should return payload', () => {
      const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MX0.fhc3wykrAnRpcKApKhXiahxaOe8PSHatad31NuIZ0Zg`;
      const expectPayload = {
        id: 1,
      };
      const result = jwt1.decodeToken(token);
      expect(result).toEqual(expectPayload);
    });
    it('jwt2 outer token, should return payload', () => {
      const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MX0.fhc3wykrAnRpcKApKhXiahxaOe8PSHatad31NuIZ0Zg`;
      const expectPayload = {
        id: 1,
      };
      const result = jwt2.decodeToken(token);
      expect(result).toEqual(expectPayload);
    });
  });
});
