/* eslint-disable */
/* tslint:disable */
/**
 * Auto-generated Zod schemas for Multi-File Test API (v1.0.0).
 * DO NOT EDIT — this file is regenerated on every run.
 */

import { z } from 'zod'

export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  age: z.number().int().optional(),
  createdAt: z.string().datetime().optional(),
})

export const errorSchema = z.object({
  code: z.number().int(),
  message: z.string(),
})

/** A list of users */
export const listUsersResponseSchema = z.array(z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  age: z.number().int().optional(),
  createdAt: z.string().datetime().optional(),
}))

/** User created */
export const createUserResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  age: z.number().int().optional(),
  createdAt: z.string().datetime().optional(),
})

/** A single user */
export const getUserResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  age: z.number().int().optional(),
  createdAt: z.string().datetime().optional(),
})

/** User deleted */
export const deleteUserResponseSchema = z.unknown()
