import { apiClient } from './client';

export interface Concert {
  id: string;
  venue: string;
  date: string; // ISO date string
  country: string;
  city: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateConcertData {
  venue: string;
  date: string;
  country: string;
  city: string;
}

/**
 * GET /concerts — list all concerts.
 */
export async function apiGetConcerts(): Promise<Concert[]> {
  const { data } = await apiClient.get<Concert[]>('/concerts');
  return data;
}

/**
 * POST /concerts — create a new concert.
 */
export async function apiCreateConcert(concertData: CreateConcertData): Promise<Concert> {
  const { data } = await apiClient.post<Concert>('/concerts', concertData);
  return data;
}

/**
 * GET /concerts/:id — fetch a single concert by ID.
 */
export async function apiGetConcert(id: string): Promise<Concert> {
  const { data } = await apiClient.get<Concert>(`/concerts/${id}`);
  return data;
}

/**
 * PATCH /concerts/:id — partial update (e.g., close { active: false } or reopen { active: true }).
 */
export async function apiPatchConcert(
  id: string,
  updates: Partial<Concert>
): Promise<Concert> {
  const { data } = await apiClient.patch<Concert>(`/concerts/${id}`, updates);
  return data;
}
