import {
  toPascalCase,
  toCamelCase,
  toKebabCase,
  singularize,
  extractResource,
  isDetailEndpoint,
  getHookName,
  getTypeName,
} from '../../src/utils/naming'

describe('toPascalCase', () => {
  it('converts kebab-case', () => {
    expect(toPascalCase('get-users')).toBe('GetUsers')
  })

  it('converts snake_case', () => {
    expect(toPascalCase('list_pets')).toBe('ListPets')
  })

  it('converts camelCase', () => {
    expect(toPascalCase('getUserById')).toBe('GetUserById')
  })

  it('converts space separated', () => {
    expect(toPascalCase('create new user')).toBe('CreateNewUser')
  })

  it('handles single word', () => {
    expect(toPascalCase('users')).toBe('Users')
  })

  it('handles already PascalCase', () => {
    expect(toPascalCase('GetUsers')).toBe('GetUsers')
  })

  it('strips non-alphanumeric characters', () => {
    expect(toPascalCase('get/users/{id}')).toBe('GetUsersId')
  })

  it('handles empty string', () => {
    expect(toPascalCase('')).toBe('')
  })
})

describe('toCamelCase', () => {
  it('converts PascalCase to camelCase', () => {
    expect(toCamelCase('GetUsers')).toBe('getUsers')
  })

  it('converts kebab-case to camelCase', () => {
    expect(toCamelCase('get-users')).toBe('getUsers')
  })

  it('converts snake_case to camelCase', () => {
    expect(toCamelCase('list_pets')).toBe('listPets')
  })

  it('keeps already camelCase', () => {
    expect(toCamelCase('getUsers')).toBe('getUsers')
  })

  it('handles single word', () => {
    expect(toCamelCase('Users')).toBe('users')
  })
})

describe('toKebabCase', () => {
  it('converts camelCase', () => {
    expect(toKebabCase('getUserById')).toBe('get-user-by-id')
  })

  it('converts PascalCase', () => {
    expect(toKebabCase('GetUserById')).toBe('get-user-by-id')
  })

  it('converts snake_case', () => {
    expect(toKebabCase('get_user_by_id')).toBe('get-user-by-id')
  })

  it('handles already kebab-case', () => {
    expect(toKebabCase('get-user-by-id')).toBe('get-user-by-id')
  })

  it('strips leading and trailing hyphens', () => {
    expect(toKebabCase('-get-users-')).toBe('get-users')
  })

  it('handles single word', () => {
    expect(toKebabCase('users')).toBe('users')
  })
})

describe('singularize', () => {
  it('singularizes regular plurals ending in s', () => {
    expect(singularize('users')).toBe('user')
    expect(singularize('pets')).toBe('pet')
  })

  it('singularizes words ending in -ies', () => {
    expect(singularize('categories')).toBe('category')
    expect(singularize('stories')).toBe('story')
  })

  it('singularizes words ending in -ses', () => {
    expect(singularize('addresses')).toBe('address')
  })

  it('singularizes words ending in -xes', () => {
    expect(singularize('boxes')).toBe('box')
  })

  it('singularizes words ending in -ches', () => {
    expect(singularize('watches')).toBe('watch')
  })

  it('singularizes words ending in -shes', () => {
    expect(singularize('dishes')).toBe('dish')
  })

  it('handles irregular plurals', () => {
    expect(singularize('people')).toBe('person')
    expect(singularize('children')).toBe('child')
    expect(singularize('data')).toBe('datum')
    expect(singularize('media')).toBe('medium')
  })

  it('does not modify already singular words', () => {
    expect(singularize('user')).toBe('user')
    expect(singularize('pet')).toBe('pet')
  })

  it('does not singularize words ending in ss', () => {
    expect(singularize('grass')).toBe('grass')
  })

  it('handles statuses -> status (via irregular)', () => {
    // statuses -> status is handled by the -ses rule
    expect(singularize('statuses')).toBe('status')
  })
})

describe('extractResource', () => {
  it('extracts last meaningful segment', () => {
    expect(extractResource('/api/v1/users/{userId}')).toBe('users')
  })

  it('extracts from simple path', () => {
    expect(extractResource('/pets')).toBe('pets')
  })

  it('extracts nested resource', () => {
    expect(extractResource('/api/v1/users/{userId}/posts')).toBe('posts')
  })

  it('skips api and version prefixes', () => {
    expect(extractResource('/api/v2/categories')).toBe('categories')
  })

  it('skips path parameters', () => {
    expect(extractResource('/users/{id}')).toBe('users')
  })

  it('handles deeply nested paths', () => {
    expect(extractResource('/users/{userId}/posts/{postId}/comments')).toBe('comments')
  })
})

describe('isDetailEndpoint', () => {
  it('returns true when path ends with a path parameter', () => {
    expect(isDetailEndpoint('/users/{id}')).toBe(true)
  })

  it('returns true for nested detail endpoints', () => {
    expect(isDetailEndpoint('/users/{userId}/posts/{postId}')).toBe(true)
  })

  it('returns false for collection endpoints', () => {
    expect(isDetailEndpoint('/users')).toBe(false)
  })

  it('returns false when path param is not last', () => {
    expect(isDetailEndpoint('/users/{id}/posts')).toBe(false)
  })
})

describe('getHookName', () => {
  it('uses operationId when provided', () => {
    expect(getHookName('listPets', 'GET', '/pets')).toBe('useListPets')
  })

  it('uses operationId with PascalCase conversion', () => {
    expect(getHookName('get-user-by-id', 'GET', '/users/{id}')).toBe('useGetUserById')
  })

  it('generates from method + path when no operationId', () => {
    const hookName = getHookName(undefined, 'GET', '/pets')
    expect(hookName).toBe('useGetPets')
  })

  it('generates POST hook as Create', () => {
    const hookName = getHookName(undefined, 'POST', '/users')
    expect(hookName).toBe('useCreateUsers')
  })

  it('generates DELETE hook as Delete', () => {
    const hookName = getHookName(undefined, 'DELETE', '/users/{id}')
    expect(hookName).toBe('useDeleteUser')
  })

  it('singularizes resource for detail endpoints', () => {
    const hookName = getHookName(undefined, 'GET', '/pets/{id}')
    expect(hookName).toBe('useGetPet')
  })

  it('handles PUT method as Update', () => {
    const hookName = getHookName(undefined, 'PUT', '/users/{id}')
    expect(hookName).toBe('useUpdateUser')
  })

  it('handles PATCH method', () => {
    const hookName = getHookName(undefined, 'PATCH', '/users/{id}')
    expect(hookName).toBe('usePatchUser')
  })
})

describe('getTypeName', () => {
  it('converts to PascalCase', () => {
    expect(getTypeName('pet')).toBe('Pet')
  })

  it('handles multi-word names', () => {
    expect(getTypeName('new-pet')).toBe('NewPet')
  })

  it('handles snake_case names', () => {
    expect(getTypeName('pet_category')).toBe('PetCategory')
  })

  it('handles already PascalCase', () => {
    expect(getTypeName('PetCategory')).toBe('PetCategory')
  })
})
