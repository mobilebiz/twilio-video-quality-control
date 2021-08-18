(async () => {
  "use strict";

  const TWILIO_DOMAIN = location.host; // 現在のURL
  const ROOM_NAME = "VideoRoom"; // 部屋の名前
  const Video = Twilio.Video; // Twilio Video JS SDK
  let videoRoom;
  const tuning = true; // チューニング（true: する、false: しない）
  const preflight = true; // 事前環境確認（true: する、false: しない）
  const tcpForced = true; // TURN(TCP:443)の利用を強制（true: する、false: しない）

  // プレビュー画面の表示
  const options = {
    video: {
      // VGA
      width: 640,
      height: 480,
      aspectRatio: 4 / 3,
      frameRate: tuning ? 15 : 24,
    },
    audio: true,
  };
  // ローカルトラックを取得
  const localTracks = await Video.createLocalTracks(options);
  // videoタブにアタッチ
  const localVideo = document.getElementById("myStream");
  localTracks.forEach((track) => {
    if (track.kind === "video" || track.kind === "audio") {
      track.attach(localVideo);
    }
  });

  // ボタンの準備
  const btnJoinRoom = document.getElementById("button-join");
  const btnLeaveRoom = document.getElementById("button-leave");

  // ガイダンスの準備
  let progress = "";
  const guide = document.getElementById("guide");

  // トークンの取得
  const getToken = () => {
    return new Promise(async (resolve, reject) => {
      try {
        const body = await axios.get(
          `${document.location.protocol}//${TWILIO_DOMAIN}/video-token?roomName=${ROOM_NAME}`
        );
        resolve([body.data.token, body.data.iceServer]);
      } catch (err) {
        reject(err);
      }
    });
  };

  // PreFlight API
  if (preflight) {
    const [publisherToken] = await getToken();
    const [subscribeToken] = await getToken();
    const preflightTest = Video.runPreflight(publisherToken, subscribeToken);

    preflightTest.on("completed", (report) => {
      progress += `
        ----------------
        Test completed in ${report.testTiming.duration} milliseconds.
        It took ${
          report.networkTiming.connect.duration
        } milliseconds to connect.
        It took ${
          report.networkTiming.media.duration
        }  milliseconds to receive media.
        ICECandidatesStats list was: ${JSON.stringify(
          report.iceCandidateStats,
          null,
          "\t"
        )}
        Selected candidates: ${JSON.stringify(
          report.selectedIceCandidatePairStats,
          null,
          "\t"
        )}
        Your network jitter was: ${JSON.stringify(
          report.stats.jitter,
          null,
          "\t"
        )}.
        Your network rtt was: ${JSON.stringify(report.stats.rtt, null, "\t")}.
        Your network packetLoss was: ${JSON.stringify(
          report.stats.packetLoss,
          null,
          "\t"
        )}
      `;
      guide.value = progress;
      // 入室ボタンを有効化
      btnJoinRoom.disabled = false;
    });
    preflightTest.on("failed", function (error) {
      progress += `Test failed: ${error}`;
      guide.value = progress;
    });
    preflightTest.on("progress", function (progressState) {
      progress += `>> ${progressState} `;
      guide.value = progress;
    });
  } else {
    // 入室ボタンを有効化
    btnJoinRoom.disabled = false;
  }

  // 入室ボタンが押されたときの処理
  btnJoinRoom.onclick = async () => {
    // アクセストークンとNTS接続リストを取得
    const [token, iceServer] = await getToken();
    console.log(`Token got. ${token}`); // 本番環境ではコメントアウトしましょう
    console.log(`IceServer: `);
    console.dir(iceServer);
    connectRoom(token, iceServer); // ルームに接続
  };

  // 退出ボタンが押されたときの処理
  btnLeaveRoom.onclick = () => {
    // 部屋から退室
    videoRoom.disconnect();
    console.log(`Disconnected to Room ${videoRoom.name}`);
    btnJoinRoom.disabled = false;
    btnLeaveRoom.disabled = true;
  };

  // ルームに接続
  const connectRoom = (token, iceServer) => {
    // 部屋に入室
    const options = {
      name: ROOM_NAME,
      tracks: localTracks,
    };
    if (tuning) {
      options.bandwidthProfile = {
        video: {
          mode: "grid",
          contentPreferencesMode: "manual",
        },
      };
      options.preferredVideoCodecs = [
        {
          codec: "VP8",
          simulcast: false,
        },
      ];
      options.maxAudioBitrate = 8000;
      options.networkQuality = {
        local: 2,
        remote: 2,
      };
    }
    if (tcpForced) {
      options.iceServers = [
        {
          credential: iceServer.credential,
          url: iceServer.url,
          urls: iceServer.urls,
          username: iceServer.username,
        },
      ];
      options.iceTransportPolicy = "relay";
    }
    console.log(`🐞 options: `);
    console.dir(options);
    Video.connect(token, options)
      .then((room) => {
        console.log(`Connected to Room ${room.name}`);
        videoRoom = room;

        // すでに入室している参加者を表示
        room.participants.forEach(participantConnected);

        // 誰かが入室してきたときの処理
        room.on("participantConnected", participantConnected);

        // 誰かが退室したときの処理
        room.on("participantDisconnected", participantDisconnected);

        // 自分が退室したときの処理
        room.once("disconnected", (error) =>
          room.participants.forEach(participantDisconnected)
        );

        btnJoinRoom.disabled = true;
        btnLeaveRoom.disabled = false;
      })
      .catch((err) => console.error(err));
  };

  // 他の参加者が入室したとき
  const participantConnected = (participant) => {
    console.log(`Participant ${participant.identity} connected'`);

    // ネットワーク環境を表示する
    const printNetworkQualityStats = (
      networkQualityLevel,
      networkQualityStats
    ) => {
      // Print in console the networkQualityLevel using bars
      const qualityLevel =
        {
          1: "▃",
          2: "▃▄",
          3: "▃▄▅",
          4: "▃▄▅▆",
          5: "▃▄▅▆▇",
        }[networkQualityLevel] || "";
      progress += `${participant.identity} ${qualityLevel}\n`;
      guide.value = progress;
      // console.log(`${participant.identity} ${qualityLevel}`);

      if (networkQualityStats) {
        // Print in console the networkQualityStats, which is non-null only if Network Quality
        // verbosity is 2 (moderate) or greater
        console.log("Network Quality statistics:", networkQualityStats);
      }
    };

    // Print the initial Network Quality Level and statistics
    printNetworkQualityStats(
      participant.networkQualityLevel,
      participant.networkQualityStats
    );

    // Print changes to Network Quality Level and statistics
    participant.on("networkQualityLevelChanged", printNetworkQualityStats);

    // 参加者を表示する
    const remote = document.getElementById("remote");
    const div = document.createElement("div");
    div.id = participant.sid;

    // 参加者のトラック（映像、音声など）を処理
    participant.tracks.forEach((publication) => {
      if (publication.isSubscribed) {
        trackSubscribed(div, publication.track);
      }
    });

    // 参加者の映像が届いたとき
    participant.on("trackSubscribed", (track) => {
      // リモートビデオトラックの解像度をHDにするようメディアサーバーに依頼
      if (tuning && track.kind === "video") {
        console.log(`🐞 Set remote video track content preference to HD.`);
        track.setContentPreferences({
          renderDimensions: {
            width: 1280,
            height: 720,
          },
        });
      }
      trackSubscribed(div, track);
    });

    // 参加者の映像が切れたとき
    participant.on("trackUnsubscribed", trackUnsubscribed);

    remote.appendChild(div);
  };

  // 他の参加者が退室したとき
  const participantDisconnected = (participant) => {
    console.log(`Participant ${participant.identity} disconnected.`);

    // 他の参加者の画面を削除する
    document.getElementById(participant.sid).remove();
  };

  // トラックの購読
  const trackSubscribed = (div, track) => {
    // トラックをアタッチする
    div.appendChild(track.attach());
  };

  // トラックの非購読
  const trackUnsubscribed = (track) => {
    // トラックのデタッチ
    track.detach().forEach((element) => element.remove());
  };
})();
