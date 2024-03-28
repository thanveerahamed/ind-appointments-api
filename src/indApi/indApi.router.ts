import { Router, Request, Response } from 'express';
import {
  blockSlots,
  getDesks,
  getSlots,
  reserveSlot,
} from '../common/clients/ind';
import { logError } from '../common/logging';

export const indApiRouter = Router();

enum Action {
  GetDesks = 'getDesks',
  GetSlots = 'getSlots',
  BlockSlot = 'blockSlot',
  ReserveSlot = 'reserveSlot',
}

indApiRouter.post('/rest', async (req: Request, res: Response) => {
  const { action, data } = req.body;
  try {
    switch (action) {
      case Action.GetDesks: {
        const desks = await getDesks(data.productType);
        res.status(200).send(desks);
        break;
      }

      case Action.GetSlots: {
        const slots = await getSlots(data);
        res.status(200).send(slots);
        break;
      }

      case Action.BlockSlot: {
        const slot = await blockSlots(data);
        res.status(200).send(slot);
        break;
      }

      case Action.ReserveSlot: {
        const slot = await reserveSlot(data);
        res.status(200).send(slot);
        break;
      }

      default:
        res.status(200).send([]);
    }
  } catch (e) {
    logError(e);
    res.status(500).send(e);
  }
});
