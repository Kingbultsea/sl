import net from 'net';

export const getIp = (ip) => {
    // 检查是否为 IPv6 映射的 IPv4 地址
    if (net.isIPv4(ip)) {
        console.log('Client IP (IPv4):', ip);
    } else if (net.isIPv6(ip) && ip.includes('::ffff:')) {
        ip = ip.split('::ffff:')[1]; // 提取 IPv4 部分
        console.log('Client IP (mapped IPv4):', ip);
    } else {
        console.log('Client IP (IPv6):', ip);
    }

    return ip;
};