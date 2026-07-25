export interface PaginationOptions {
  page: number;
  limit: number;
  skip: number;
}

export function parsePagination(
  query: { page?: string | number; limit?: string | number },
  defaultLimit = 50,
  maxLimit = 200
): PaginationOptions {
  let page = parseInt(String(query.page || 1), 10);
  let limit = parseInt(String(query.limit || defaultLimit), 10);

  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;

  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  pagination: PaginationOptions
) {
  const totalPages = Math.ceil(total / pagination.limit);

  return {
    items: data,
    meta: {
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages,
      hasNextPage: pagination.page < totalPages,
      hasPrevPage: pagination.page > 1,
    },
  };
}

export default parsePagination;
