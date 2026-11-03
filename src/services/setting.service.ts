import { prisma } from '../lib/prisma.js';
import { SettingModel, type SettingChanges } from '../models/setting.model.js';

export const SettingService = {
  get: () => SettingModel.get(prisma),
  update: (changes: SettingChanges) => SettingModel.update(prisma, changes),
};
