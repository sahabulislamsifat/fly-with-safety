const config:import('vitest/config').ViteUserConfig={
  root:__dirname,envDir:false,resolve:{alias:{
    '@':__dirname+'/../../client/src',
    '@reduxjs/toolkit':__dirname+'/../../client/node_modules/@reduxjs/toolkit/dist/redux-toolkit.modern.mjs',
  }},
  test:{include:['phase2-booking-foundation.test.ts'],globalSetup:[],setupFiles:[],environment:'node',pool:'threads',maxWorkers:1,
    fileParallelism:false,isolate:true,watch:false,cache:false,testTimeout:5000,coverage:{enabled:false}},
};
module.exports=config;
