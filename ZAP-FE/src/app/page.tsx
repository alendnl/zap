import { StudentWorkspace } from "@/components/StudentWorkspace";
import type { QuestionData } from "@/components/QuestionPane";

const MOCK_QUESTION: QuestionData = {
  id: "660000000000000000000001",
  slug: "two-sum",
  title: "Two Sum",
  difficulty: "EASY",
  tags: ["array", "hash-map"],
  statement: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.`,
  examples: [
    {
      input: "4\n2 7 11 15\n9",
      output: "0 1",
      explanation: "Because nums[0] + nums[1] == 9, we return 0 1.",
    },
    {
      input: "3\n3 2 4\n6",
      output: "1 2",
    },
  ],
  constraints: [
    "2 <= nums.length <= 10^4",
    "-10^9 <= nums[i] <= 10^9",
    "-10^9 <= target <= 10^9",
    "Only one valid answer exists.",
  ],
};

export default function ProblemPage() {
  return <StudentWorkspace question={MOCK_QUESTION} />;
}
