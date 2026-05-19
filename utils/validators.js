const Joi = require('joi');

const leadSchema = Joi.object({
  name:        Joi.string().min(2).max(100).required(),
  company:     Joi.string().min(1).max(120).required(),
  email:       Joi.string().email().required(),
  phone:       Joi.string().allow('').optional(),
  country:     Joi.string().required(),
  sector:      Joi.string().required(),
  score:       Joi.number().min(0).max(100).required(),
  painType:    Joi.string().allow('').optional(),
  projectStage:Joi.string().allow('').optional(),
  source:      Joi.string().required(),
  assignee:    Joi.string().required(),
  valueUSD:    Joi.number().min(0).optional(),
  probability: Joi.number().min(0).max(100).optional(),
  stage:       Joi.string().length(2).optional(),
  entryType:   Joi.string().valid('automatic','manual').optional(),
  notes:       Joi.string().allow('').optional(),
}).options({ allowUnknown: true });

const loginSchema = Joi.object({
  email:    Joi.string().email().required(),
  password: Joi.string().min(4).required(),
});

const stageSchema = Joi.object({
  newStage: Joi.string().length(2).required(),
  reason:   Joi.string().allow('').optional(),
});

const validate = (schema, data) => {
  const { error, value } = schema.validate(data, { abortEarly: false });
  if (error) {
    const msg = error.details.map(d => d.message).join('; ');
    return { valid: false, error: msg };
  }
  return { valid: true, value };
};

module.exports = { leadSchema, loginSchema, stageSchema, validate };
