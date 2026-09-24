import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getApiInfo() {
    return {
      name: 'Northstar Auction House API',
      documentation: '/api/docs',
      auctions: '/auctions',
    };
  }
}
