export const getPagination = (page = 1, limit = 25): { offset: number; limit: number } => {
  return {
    offset: (page - 1) * limit,
    limit
  };
};
