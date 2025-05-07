#!/bin/bash
# Linux痕迹清理脚本
# 需要root权限执行

if [ "$(id -u)" -ne 0 ]; then
    echo "请使用root权限运行此脚本！"
    exit 1
fi

echo "正在清理系统痕迹..."

# 1. 清除命令历史
echo "清理命令历史..."
rm -f /root/.bash_history
rm -f /home/*/.bash_history
unset HISTFILE
history -c

# 2. 清除系统日志
echo "清理系统日志..."
# 清空主要日志文件
log_files=(
    "/var/log/auth.log*"
    "/var/log/secure*"
    "/var/log/messages*"
    "/var/log/syslog*"
    "/var/log/utmp"
    "/var/log/wtmp"
    "/var/log/btmp"
    "/var/log/lastlog"
    "/var/log/faillog"
    "/var/log/cron*"
    "/var/log/httpd/*"
    "/var/log/apache2/*"
    "/var/log/nginx/*"
    "/var/log/mysql/*"
)

for file in "${log_files[@]}"; do
    if [ -f "$file" ] || [ -d "$file" ]; then
        echo "清理 $file..."
        rm -rf "$file"
    fi
done

# 3. 清除临时文件
echo "清理临时文件..."
rm -rf /tmp/*
rm -rf /var/tmp/*

# 4. 清除SSH相关痕迹
echo "清理SSH痕迹..."
rm -f /root/.ssh/known_hosts
rm -f /home/*/.ssh/known_hosts

# 5. 清除邮件痕迹
echo "清理邮件痕迹..."
rm -f /var/mail/*
rm -f /var/spool/mail/*

# 6. 清除其他用户痕迹
echo "清理其他用户痕迹..."
find / -name ".*_history" -exec rm -f {} \;
find / -name "*.log" -exec rm -f {} \;

# 7. 清空内存中的日志
echo "清空内存日志..."
echo "" > /var/log/syslog
echo "" > /var/log/messages
echo "" > /var/log/auth.log

# 8. 禁用系统日志记录（可选）
# echo "禁用系统日志记录..."
# systemctl stop rsyslog
# systemctl stop syslog

echo "痕迹清理完成！建议立即重启系统。"

# 可选：执行后自动重启
# read -p "是否立即重启系统？(y/n)" -n 1 -r
# echo
# if [[ $REPLY =~ ^[Yy]$ ]]; then
#     reboot
# fi