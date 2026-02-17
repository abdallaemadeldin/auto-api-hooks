/* eslint-disable */
/* tslint:disable */
/**
 * Auto-generated TypeScript types for Multi-File Test API (v1.0.0).
 * DO NOT EDIT — this file is regenerated on every run.
 */

export interface User {
  id: string
  name: string
  email: string
  age?: number
  createdAt?: string
}

export interface Error {
  code: number
  message: string
}

/** List all users */
export interface ListUsersParams {
  limit?: number
  offset?: number
}

/** A list of users */
export type ListUsersResponse = Array<{
  id: string
  name: string
  email: string
  age?: number
  createdAt?: string
}>

export type CreateUserBody = {
  name: string
  email: string
  age?: number
}

/** User created */
export type CreateUserResponse = {
  id: string
  name: string
  email: string
  age?: number
  createdAt?: string
}

/** Get a user by ID */
export interface GetUserParams {
  id: string
}

/** A single user */
export type GetUserResponse = {
  id: string
  name: string
  email: string
  age?: number
  createdAt?: string
}

/** Delete a user */
export interface DeleteUserParams {
  id: string
}

/** User deleted */
export type DeleteUserResponse = unknown
