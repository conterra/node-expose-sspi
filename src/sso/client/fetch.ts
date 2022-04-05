import type { RequestInit, Response } from 'node-fetch';
import { loadNodeFetch } from '../loadNodeFetch';

export interface FetchFunction {
  (resource: string, init?: RequestInit): Promise<Response>;
}

let effectiveFetch: FetchFunction;
/**
 * Allow overwriting of the concrete fetch implementation.
 * @param f a concrete fetch implementation.
 */
export function setFetchImpl(f: FetchFunction) {
  effectiveFetch = f;
}

/**
 * Abstraction of the fetch function like node-fetch.
 *
 * @param {string} resource - the URL to fetch
 * @param {RequestInit} [init] - the options (headers, body, etc.)
 * @returns {Promise<Response>} a promise with the HTTP response.
 */
export async function fetch(
  resource: string,
  init?: RequestInit
): Promise<Response> {
  if (!effectiveFetch) {
    effectiveFetch = (await loadNodeFetch()).fetch;
  }
  return effectiveFetch(resource, init);
}
