import React from "react";

const quests = [
  {
    title: "📣 Share Fluxora on 3 Telegram Groups",
    description: "Help us grow by sharing Fluxora in active crypto groups.",
    reward: "💰 0.01 ETH"
  },
  {
    title: "📝 Write a Blog Post About Fluxora",
    description: "Write and publish a blog post explaining Fluxora’s features.",
    reward: "💰 0.02 ETH"
  },
  {
    title: "🐞 Report a Bug",
    description: "Found a bug or issue? Report it and help improve the dApp.",
    reward: "💰 0.005 ETH"
  },
  {
    title: "🎥 Make a YouTube Short",
    description: "Create a short 30s YouTube video about how Fluxora works.",
    reward: "💰 0.015 ETH"
  }
];

const QuestList = () => {
  return (
    <div className="p-4 space-y-4">
      {quests.map((quest, index) => (
        <div key={index} className="bg-white p-4 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold">{quest.title}</h2>
          <p className="text-gray-600">{quest.description}</p>
          <p className="text-green-600 font-bold mt-2">{quest.reward}</p>
        </div>
      ))}
    </div>
  );
};

export default QuestList;
