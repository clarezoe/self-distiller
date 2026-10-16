import json, os, urllib.request
cases = [
 ("good_ack", "都不想，这周累死了，我只想睡觉。你怎么突然问这个？", "没事，随口问问，听起来你是真的累了。那如果我们本来约好周末一起出去，我临时跟你说不去了，你会怎么回我？"),
 ("ignores_reply", "都不想，这周累死了，我只想睡觉。你怎么突然问这个？", "那我临时说不去了，你会怎么回？"),
 ("wrong_language", "都不想，这周累死了，我只想睡觉。你怎么突然问这个？", "No worries, just asking. If I cancelled our weekend plan last minute, what would you say?"),
 ("repeat_question", "都不想，这周累死了，我只想睡觉。你怎么突然问这个？", "周末你想去爬山还是在家看电影？"),
 ("good_answers_question", "你先说你为什么问？", "哈，就是想约你出去玩嘛，最近都没见你。那要是我临时放你鸽子，你会怎么说我？"),
 ("out_of_persona_formal", "都不想，这周累死了，我只想睡觉。你怎么突然问这个？", "感谢您的回复。请问在朋友临时取消约定时，您通常会采取何种沟通方式？"),
]
out = {}
for name, user, agent in cases:
    body = {"model": "jev-latest",
      "state": {"interview_language": "zh", "interviewer_persona": "close friend (casual, warm, teasing)",
        "goal": "See how the user reacts when a friend changes weekend plans last minute",
        "transcript": [{"speaker":"interviewer","text":"周末你想去爬山还是在家看电影？"},{"speaker":"user","text":user}],
        "candidate_next_interviewer_message": agent},
      "questions": {
        "responds": {"type":"noul","instructions":"Does `candidate_next_interviewer_message` respond to or acknowledge what the user actually said in their LAST message (including answering any question the user asked), rather than ignoring it?"},
        "in_character": {"type":"noul","instructions":"Is `candidate_next_interviewer_message` written in `interview_language` and does it sound like `interviewer_persona` talking in a chat?"},
        "not_repeat": {"type":"noul","instructions":"Does `candidate_next_interviewer_message` avoid repeating a question the interviewer already asked in `transcript`?"}}}
    req = urllib.request.Request("https://api.typesafe.ai/v1/systemone", data=json.dumps(body).encode(), headers={"Authorization":"Bearer "+os.environ["TYPESAFE_API_KEY"],"Content-Type":"application/json"})
    a = json.load(urllib.request.urlopen(req))["answers"]
    print(f"{name:22} responds={a['responds']['noul']:.2f} in_char={a['in_character']['noul']:.2f} not_repeat={a['not_repeat']['noul']:.2f}")
