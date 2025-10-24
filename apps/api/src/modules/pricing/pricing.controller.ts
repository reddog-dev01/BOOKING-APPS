import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { QuoteRequestDto } from './dto/quote.dto';

// FE đang gọi /price/quote → mở alias cùng /pricing/quote
@Controller(['price','pricing'])
export class PricingController {
  constructor(private svc: PricingService) {}
  @Post('quote') @HttpCode(200)
  quote(@Body() dto: QuoteRequestDto) { return this.svc.quote(dto); }
}
