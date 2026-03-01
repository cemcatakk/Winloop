/**
 * Placeholder for request validation/sanitization.
 * All game actions must be validated server-side (scores, limits, business rules).
 * Extend with schema validation (e.g. joi, zod) per route.
 */

function validateBody(schema) {
  return (req, res, next) => {
    try {
      const result = schema.safeValidate ? schema.safeValidate(req.body) : schema.validate(req.body);
      const error = result.error || result.errors;
      if (error) {
        return res.status(400).json({ error: 'Validation failed', details: error.details || error });
      }
      if (result.value) req.body = result.value;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { validateBody };
