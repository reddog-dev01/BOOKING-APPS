import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { QuoteRequestDto } from './dto/quote.dto';

// FE đang gọi /api/quote; đồng thời giữ alias cũ /api/pricing/quote và /api/price/quote
@Controller()
export class PricingController {
  constructor(private svc: PricingService) {}

  @Post(['quote', 'pricing/quote', 'price/quote'])
  @HttpCode(200)
  quote(@Body() dto: QuoteRequestDto) {
    return this.svc.quote(dto);
  }
}
