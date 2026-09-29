FROM node:20-bullseye

ENV DEBIAN_FRONTEND=noninteractive

# Install SSH server + tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssh-server \
    sudo \
    procps \
    passwd \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /var/run/sshd

# SSH config default (akan di-override oleh ssh-user-config.sh)
RUN sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config

WORKDIR /app

# Install webui deps
COPY webui/package.json /app/webui/package.json
RUN cd /app/webui && npm install --omit=dev

# Copy app files
COPY webui/server.js /app/webui/server.js
COPY webui/index.html /app/webui/index.html
COPY ssh-user-config.sh /app/ssh-user-config.sh
COPY start.sh /app/start.sh
RUN chmod +x /app/ssh-user-config.sh /app/start.sh

# Railway default: HTTP port 8080, SSH port 22 (butuh TCP proxy)
EXPOSE 8080 22

CMD ["/app/start.sh"]