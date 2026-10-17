import { ExecutionContext, HttpException } from '@nestjs/common';
import { AiExplainRateLimitGuard } from './ai-explain-rate-limit.guard';

function makeContext(userId: string, setHeader = jest.fn()) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: { id: userId } }),
      getResponse: () => ({ setHeader }),
    }),
    setHeader,
  } as unknown as ExecutionContext & { setHeader: jest.Mock };
}

describe('AiExplainRateLimitGuard', () => {
  it('limits each user to ten requests per minute', () => {
    const guard = new AiExplainRateLimitGuard();
    const context = makeContext('user-id');

    for (let count = 0; count < 10; count++) {
      expect(guard.canActivate(context)).toBe(true);
    }

    try {
      guard.canActivate(context);
      fail('Expected the request limit to be enforced');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
      expect(context.setHeader).toHaveBeenCalledWith(
        'Retry-After',
        expect.any(Number),
      );
    }
  });
});
