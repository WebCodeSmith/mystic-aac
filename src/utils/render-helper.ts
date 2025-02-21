import { Response } from 'express';
import path from 'path';

export const renderPage = (
  res: Response, 
  page: string, 
  options: { 
    title: string, 
    error?: string, 
    success?: string,
    onlinePlayers?: number,
    message?: string
  }
) => {
  res.render(path.join(__dirname, `../../views/pages/${page}`), options);
};
