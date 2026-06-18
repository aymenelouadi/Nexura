import { Global, Module } from '@nestjs/common';
import { parseApiEnvironment } from '@nexura/shared';

import { API_ENVIRONMENT } from './tokens.js';

@Global()
@Module({
  providers: [
    {
      provide: API_ENVIRONMENT,
      useFactory: () => parseApiEnvironment(process.env),
    },
  ],
  exports: [API_ENVIRONMENT],
})
export class ConfigModule {}
