import { Body, Controller, Post } from '@nestjs/common';

import { QuoteRequestDto } from './dto/quote-request.dto';
import { QuoteResponseDto } from './dto/quote-response.dto';
import { PricingService } from './pricing.service';

// Sample curl (DEV):
// now=$(date -Iseconds)
// curl -i -H 'content-type: application/json' \
//   -d '{"tripType":"AIRPORT","vehicleTypeId":1,"startAt":"'"$now"'","roundTrip":false,"withVat":true,"vatPct":10,"fromText":"Noi Bai","toText":"Hoan Kiem","fromLat":21.214,"fromLng":105.806,"toLat":21.033,"toLng":105.851,"airportCode":"HAN","direction":"IN"}' \
//   http://localhost:3006/pricing/quote
// curl -i -H 'content-type: application/json' \
//   -d '{"tripType":"ROAD","routeCode":"HN-QN","vehicleTypeId":1,"startAt":"'"$now"'","roundTrip":true,"withVat":true}' \
//   http://localhost:3006/price/quote
@Controller(['price', 'pricing'])
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Post('quote')
  quote(@Body() dto: QuoteRequestDto): Promise<QuoteResponseDto> {
    return this.pricingService.createQuote(dto);
  }
}
