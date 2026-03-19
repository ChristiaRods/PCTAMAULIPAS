import { functionName, projectId, publicAnonKey } from "/utils/supabase/info";

export const API_BASE = `https://${projectId}.supabase.co/functions/v1/${functionName}`;

export const apiHeaders = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${publicAnonKey}`,
};
