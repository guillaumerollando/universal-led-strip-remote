import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { Rgb } from '../core/elk';
import type { FamilyId, Transport } from '../core/families';
import type { IrRemoteId } from '../core/ir';
import type { IrSetup } from '../core/irSetup';

/** Dernier état connu d'un appareil (ce que l'appli lui a envoyé : ces contrôleurs ne répondent pas). */
export interface LightState {
  on?: boolean;
  rgb?: Rgb;
  /** 0 à 100. */
  brightness?: number;
  /** Identifiant d'effet en cours, s'il y en a un. */
  effect?: string;
  /** Vitesse des effets, 0 à 100. */
  speed?: number;
}

/** Un appareil que l'utilisateur a gardé dans « Mes appareils ». */
export interface SavedDevice {
  key: string;
  /** Le nom donné par l'utilisateur (« Néon salon »). */
  name: string;
  family: FamilyId;
  transport: Transport;
  rawName: string;
  address: string;
  model?: string;
  /** Ruban infrarouge configuré par l'assistant : ses codes marche/arrêt et son jeu de couleurs. */
  ir?: IrSetup;
  /** Ancien format (avant l'assistant) : une télécommande connue. */
  irRemote?: IrRemoteId;
  roomId?: string;
  state?: LightState;
  /** Ce que le pilote doit retenir pour joindre l'appareil (jeton d'un pont, numéro de lampe, port…). */
  meta?: Record<string, string>;
  addedAt: number;
}

export interface Room {
  id: string;
  name: string;
}

interface Data {
  devices: SavedDevice[];
  rooms: Room[];
}

const STORAGE_KEY = 'rubanix.devices.v1';
const ROOMS_KEY = 'rubanix.rooms.v1';
let data: Data = { devices: [], rooms: [] };
let loaded = false;
const listeners = new Set<() => void>();

function set(next: Partial<Data>): void {
  data = { ...data, ...next };
  listeners.forEach((l) => l());
}

async function persist(): Promise<void> {
  await AsyncStorage.multiSet([
    [STORAGE_KEY, JSON.stringify(data.devices)],
    [ROOMS_KEY, JSON.stringify(data.rooms)],
  ]);
}

/** Charge appareils et pièces (une fois, au démarrage). */
export async function loadDevices(): Promise<void> {
  if (loaded) return;
  const [[, devices], [, rooms]] = await AsyncStorage.multiGet([STORAGE_KEY, ROOMS_KEY]);
  loaded = true;
  set({
    devices: devices ? (JSON.parse(devices) as SavedDevice[]) : [],
    rooms: rooms ? (JSON.parse(rooms) as Room[]) : [],
  });
}

/** Lecture directe (hors React), pour les liens profonds. */
export const getDevices = (): SavedDevice[] => data.devices;
export const getRooms = (): Room[] => data.rooms;

export function getDevice(key: string): SavedDevice | undefined {
  return data.devices.find((d) => d.key === key);
}

export async function saveDevice(device: SavedDevice): Promise<void> {
  const exists = data.devices.some((d) => d.key === device.key);
  set({ devices: exists ? data.devices.map((d) => (d.key === device.key ? device : d)) : [...data.devices, device] });
  await persist();
}

export async function updateDevice(key: string, patch: Partial<SavedDevice>): Promise<void> {
  set({ devices: data.devices.map((d) => (d.key === key ? { ...d, ...patch } : d)) });
  await persist();
}

/** Retient ce qu'on vient d'envoyer à un appareil enregistré (sans effet si l'appareil n'est pas enregistré). */
export async function rememberState(key: string, patch: LightState): Promise<void> {
  const device = getDevice(key);
  if (!device) return;
  await updateDevice(key, { state: { ...device.state, ...patch } });
}

export async function removeDevice(key: string): Promise<void> {
  set({ devices: data.devices.filter((d) => d.key !== key) });
  await persist();
}

export async function addRoom(name: string): Promise<Room> {
  const room = { id: `room-${Date.now()}`, name: name.trim() };
  set({ rooms: [...data.rooms, room] });
  await persist();
  return room;
}

export async function renameRoom(id: string, name: string): Promise<void> {
  set({ rooms: data.rooms.map((r) => (r.id === id ? { ...r, name: name.trim() } : r)) });
  await persist();
}

/** Supprime une pièce ; ses appareils restent, sans pièce. */
export async function removeRoom(id: string): Promise<void> {
  set({
    rooms: data.rooms.filter((r) => r.id !== id),
    devices: data.devices.map((d) => (d.roomId === id ? { ...d, roomId: undefined } : d)),
  });
  await persist();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const useData = (): Data => useSyncExternalStore(subscribe, () => data);

/** Les appareils enregistrés, dans l'ordre d'ajout. */
export function useSavedDevices(): SavedDevice[] {
  return useData().devices;
}

export function useSavedDevice(key: string | undefined): SavedDevice | undefined {
  return useSavedDevices().find((d) => d.key === key);
}

export function useRooms(): Room[] {
  return useData().rooms;
}
