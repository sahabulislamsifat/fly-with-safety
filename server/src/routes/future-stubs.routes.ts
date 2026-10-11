import { Router as createRouter, type Router, Request, Response } from 'express';
import { error } from '../utils/response.js';

const router: Router = createRouter();

function notImplemented(featureName: string) {
  return (_req: Request, res: Response) => {
    res
      .status(501)
      .json(
        error(
          'NOT_IMPLEMENTED',
          `${featureName} is planned for a future release (Phases 6–10) and is not yet implemented.`,
        ),
      );
  };
}

// Phase 7: Retention & alerts
router.all('/price-alerts*', notImplemented('Price alerts'));
router.all('/saved-searches*', notImplemented('Saved searches'));
router.all('/wishlist*', notImplemented('Wishlist'));
router.all('/flexible-dates*', notImplemented('Flexible dates fare calendar'));

// Phase 8: Discovery
router.all('/explore*', notImplemented('Explore recommendation engine'));
router.all('/travel-guides*', notImplemented('Curated travel guides'));

// Phase 9: Advanced
router.all('/trips*', notImplemented('Multi-service trip organizer'));
router.all('/flight-tracker*', notImplemented('Live flight tracker'));
router.all('/ai-assistant*', notImplemented('AI travel assistant'));

export default router;
