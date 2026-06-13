// PM2 配置文件 - 生产环境
// 使用方式: pm2 start ecosystem.config.js
// 部署更新: pm2 reload ecosystem.config.js

module.exports = {
  apps: [
    // 主应用
    {
      name: 'manager-backend',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        DEBUG: 'bot*',
      },
      // 日志配置
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // 日志切割配置（保留7天）
      max_size: '10M',
      retain: 7,
      compress: true,
    },
    // Bot 应用 - 每小时第30分钟执行一次（设置 Webhook）
    {
      name: 'manager-bot',
      script: 'dist/bot/index.js',
      instances: 1,
      autorestart: false, // 执行一次后退出，不自动重启
      watch: false,
      exec_mode: 'fork',
      max_memory_restart: '1G',
      cron_restart: '30 * * * *', // 每小时第30分钟执行一次
      env: {
        NODE_ENV: 'production',
        DEBUG: 'bot*',
      },
      // 日志配置
      error_file: './logs/bot-error.log',
      out_file: './logs/bot-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // 日志切割配置（保留7天）
      max_size: '10M',
      retain: 7,
      compress: true,
    },
    // 群发消息任务 - 使用 node-cron 每10秒执行一次
    {
      name: 'manager-task',
      script: 'dist/tasks/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true, // 常驻进程，PM2 保障自动重启
      watch: false,
      env: {
        NODE_ENV: 'production',
        DEBUG: 'bot*',
      },
      // 日志配置
      error_file: './logs/group-messages-error.log',
      out_file: './logs/group-messages-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // 日志切割配置（保留7天）
      max_size: '10M',
      retain: 7,
      compress: true,
    },
    // 频道定时发送任务
    // {
    //   name: 'manager-task-channel-post',
    //   script: 'dist/tasks/checkChannelPost.js',
    //   instances: 1,
    //   exec_mode: 'fork',
    //   autorestart: true, // 常驻进程，PM2 保障自动重启
    //   watch: false,
    //   env: {
    //     NODE_ENV: 'production',
    //     DEBUG: 'bot*',
    //   },
    //   // 日志配置
    //   error_file: './logs/channel-post-error.log',
    //   out_file: './logs/channel-post-out.log',
    //   log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    //   merge_logs: true,
    //   // 日志切割配置（保留7天）
    //   max_size: '10M',
    //   retain: 7,
    //   compress: true,
    // },
    // 群组成员名称变更任务
    // {
    //   name: 'manager-chatmember-name-updated',
    //   script: 'dist/tasks/checkGroupMemberNameUpdated.js',
    //   instances: 1,
    //   exec_mode: 'fork',
    //   autorestart: true, // 常驻进程，PM2 保障自动重启
    //   watch: false,
    //   env: {
    //     NODE_ENV: 'production',
    //     DEBUG: 'bot*',
    //   },
    //   // 日志配置
    //   error_file: './logs/chatmember-name-updated-error.log',
    //   out_file: './logs/chatmember-name-updated-out.log',
    //   log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    //   merge_logs: true,
    //   // 日志切割配置（保留7天）
    //   max_size: '10M',
    //   retain: 7,
    //   compress: true,
    // },
    {
      name: 'manager-lottery',
      script: 'dist/tasks/lottery.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true, // 常驻进程，PM2 保障自动重启
      watch: false,
      env: {
        NODE_ENV: 'production',
        DEBUG: 'bot*',
      },
      // 日志配置
      error_file: './logs/lottery-error.log',
      out_file: './logs/lottery-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // 日志切割配置（保留7天）
      max_size: '10M',
    },
    {
      name: 'manager-auction',
      script: 'dist/tasks/auction.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        DEBUG: 'bot*',
      },
      error_file: './logs/auction-error.log',
      out_file: './logs/auction-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_size: '10M',
      retain: 7,
      compress: true,
    },
    {
      name: 'manager-redpacket',
      script: 'dist/tasks/redpacket.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        DEBUG: 'bot*',
      },
      error_file: './logs/redpacket-error.log',
      out_file: './logs/redpacket-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_size: '10M',
      retain: 7,
      compress: true,
    },
    {
      name: 'manager-recharge',
      script: 'dist/tasks/recharge.js',
      instances: 1,
      exec_mode: 'cluster',
      autorestart: true, // 常驻进程，PM2 保障自动重启
      watch: false,
      env: {
        NODE_ENV: 'production',
        DEBUG: 'bot*',
      },
      // 日志配置
      error_file: './logs/recharge-error.log',
      out_file: './logs/recharge-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // 日志切割配置（保留7天）
      max_size: '10M',
      retain: 7,
      compress: true,
    },
    // 活跃奖励结算任务 - 每天 00:00 执行，按周期为各机器人发放积分
    {
      name: 'manager-activity-reward',
      script: 'dist/tasks/activityReward.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        DEBUG: 'bot*',
      },
      error_file: './logs/activity-reward-error.log',
      out_file: './logs/activity-reward-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_size: '10M',
      retain: 7,
      compress: true,
    },
  ],
};

