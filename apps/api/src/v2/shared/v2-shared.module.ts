import { Global, Module } from '@nestjs/common';
import { V2KakaoTemplateCatalogService } from './v2-kakao-template-catalog.service';
import { V2ReadinessService } from './v2-readiness.service';

@Global()
@Module({
  providers: [V2ReadinessService, V2KakaoTemplateCatalogService],
  exports: [V2ReadinessService, V2KakaoTemplateCatalogService]
})
export class V2SharedModule {}
