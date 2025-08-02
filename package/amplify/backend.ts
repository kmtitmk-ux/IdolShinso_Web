import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { myFirstFunction } from './functions/my-first-function/resource';
import { sayHello } from './functions/say-hello/resource';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
defineBackend({
  sayHello,
  auth,
  data,
  myFirstFunction
});
