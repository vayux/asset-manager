// Copy only allow-listed fields so clients cannot set userId, id, isActive, timestamps, etc.
const pick = (source = {}, fields) => fields.reduce((acc, field) => {
  if (source[field] !== undefined) acc[field] = source[field];
  return acc;
}, {});

module.exports = pick;
