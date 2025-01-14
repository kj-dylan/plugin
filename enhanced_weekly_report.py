try:
    import git
except ImportError:
    print("请先安装 gitpython 包：")
    print("运行命令：pip install gitpython")
    exit(1)

from datetime import datetime, timedelta
import json
from collections import defaultdict
import re
from typing import List, Dict, Tuple
import itertools
import os
import traceback
import glob  # 添加这行到文件顶部的导入部分
from openai import OpenAI

class WeeklyReportGenerator:
    def __init__(self, config_path='scripts/report_config.json', repos_root=None):
        try:
            # 尝试多个可能的配置文件路径
            possible_paths = [
                config_path,
                os.path.join(os.path.dirname(__file__), 'report_config.json'),
                'report_config.json',
                os.path.join(os.path.dirname(os.path.abspath(__file__)), 'report_config.json')
            ]
            
            config_file = None
            for path in possible_paths:
                if os.path.exists(path):
                    config_file = path
                    break
            
            if config_file is None:
                print("错误：找不到配置文件。尝试过以下路径：")
                for path in possible_paths:
                    print(f"- {path}")
                print("\n请确保配置文件存在且路径正确")
                exit(1)
                
            self.config = self._load_config(config_file)
            
        except FileNotFoundError:
            print(f"错误：找不到配置文件 {config_path}")
            print("请确保配置文件存在且路径正确")
            exit(1)
            
        # 处理通配符路径
        self.repos_root = repos_root or '/root/ousel'
        if '*' in self.repos_root:
            self.repos = []
            for path in glob.glob(self.repos_root):
                repos = self._find_git_repos(path)
                self.repos.extend(repos)
        else:
            self.repos = self._find_git_repos(self.repos_root)
            
        if not self.repos:
            print(f"错误：在 {self.repos_root} 目录下未找到任何Git仓库")
            print("已搜索的目录：")
            if '*' in self.repos_root:
                for path in glob.glob(self.repos_root):
                    print(f"- {path}")
            else:
                print(f"- {self.repos_root}")
            exit(1)

        self.openai_api_key = self.config.get('openai_api_key', '')  # 从配置文件读取API密钥
        if not self.openai_api_key:
            print("警告：未配置OpenAI API密钥，将使用默认总结方法")


    def _find_git_repos(self, root_path: str) -> List[git.Repo]:
        """只查找根目录下的直接子目录中的Git仓库"""
        repos = []
        try:
            # 只获取直接子目录
            first_level_dirs = [d for d in os.listdir(root_path) 
                              if os.path.isdir(os.path.join(root_path, d))]
            
            for dir_name in first_level_dirs:
                dir_path = os.path.join(root_path, dir_name)
                git_dir = os.path.join(dir_path, '.git')
                
                if os.path.exists(git_dir) and os.path.isdir(git_dir):
                    try:
                        repo = git.Repo(dir_path)
                        print(f"找到Git仓库：{dir_path}")
                        repos.append(repo)
                    except git.exc.InvalidGitRepositoryError:
                        continue
                        
        except Exception as e:
            print(f"搜索目录 {root_path} 时出错: {str(e)}")
            
        return repos

    def _load_config(self, config_path: str) -> dict:
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def get_commits(self, start_date: str, end_date: str) -> List[Dict]:
        """获取所有仓库的提交记录"""
        all_commits = []
        for repo in self.repos:
            try:
                repo_name = os.path.basename(repo.working_dir)
                for commit in repo.iter_commits(
                    'HEAD',
                    since=start_date,
                    until=end_date,
                    author=self.config.get('author_email', None)  # 可以在配置文件中指定作者邮箱
                ):
                    if not any(re.match(pattern, commit.message) 
                              for pattern in self.config['ignore_patterns']):
                        all_commits.append({
                            'hash': commit.hexsha[:7],
                            'author': commit.author.name,
                            'date': commit.committed_datetime,
                            'message': commit.message.strip(),
                            'files': list(commit.stats.files.keys()),
                            'repo': repo_name  # 添加仓库名称
                        })
            except git.exc.GitCommandError as e:
                print(f"获取仓库 {repo_name} 的提交记录时出错: {e}")
        
        # 按时间排序
        all_commits.sort(key=lambda x: x['date'], reverse=True)
        return all_commits

    def summarize_commits(self, commits: List[Dict]) -> List[str]:
        """将提交记录总结为主要工作内容"""
        # 按类别分组提交
        categories = defaultdict(list)
        for commit in commits:
            message = commit['message'].lower()
            categorized = False
            for category, keywords in self.config['categories'].items():
                if any(keyword in message for keyword in keywords):
                    categories[category].append(commit)
                    categorized = True
                    break
            if not categorized:
                categories['其他'].append(commit)

        # 生成主要工作内容
        summaries = []
        
        # 处理功能开发类提交
        if categories['功能开发']:
            features = self._group_similar_commits(categories['功能开发'])
            summaries.extend([f"完成{group[0]['message'].split(':')[-1].strip()}"
                            for group in features[:3]])

        # 处理Bug修复类提交
        if categories['Bug修复']:
            bugs = self._group_similar_commits(categories['Bug修复'])
            summaries.extend([f"修复{group[0]['message'].split(':')[-1].strip()}"
                            for group in bugs[:2]])

        # 处理优化改进类提交
        if categories['优化改进']:
            improvements = self._group_similar_commits(categories['优化改进'])
            summaries.extend([f"优化{group[0]['message'].split(':')[-1].strip()}"
                            for group in improvements[:2]])

        # 其他重要工作
        other_important = []
        for category, commits in categories.items():
            if category not in ['功能开发', 'Bug修复', '优化改进']:
                grouped = self._group_similar_commits(commits)
                if grouped:
                    other_important.extend([
                        f"{group[0]['message'].split(':')[-1].strip()}"
                        for group in grouped[:1]
                    ])

        # 合并所有总结，限制在10条以内
        all_summaries = summaries + other_important
        return all_summaries[:10]

    def _group_similar_commits(self, commits: List[Dict]) -> List[List[Dict]]:
        """将相似的提交分组"""
        if not commits:
            return []

        groups = []
        used = set()

        for i, commit in enumerate(commits):
            if i in used:
                continue

            current_group = [commit]
            message = commit['message'].lower()

            for j, other in enumerate(commits[i+1:], i+1):
                if j not in used and self._is_similar(message, other['message'].lower()):
                    current_group.append(other)
                    used.add(j)

            used.add(i)
            groups.append(current_group)

        return sorted(groups, key=lambda x: len(x), reverse=True)

    def _is_similar(self, msg1: str, msg2: str) -> bool:
        """判断两个提交信息是否相似"""
        words1 = set(re.findall(r'\w+', msg1))
        words2 = set(re.findall(r'\w+', msg2))
        intersection = words1 & words2
        return len(intersection) / max(len(words1), len(words2)) > 0.5

    def optimize_summary(self, content: str) -> str:
        """优化任务内容总结，使用更智能的方式压缩内容"""
        # 移除不必要的前缀词
        content = re.sub(r'^(完成|修复|优化|实现|新增|添加)\s*', '', content)
        
        # 提取主要内容（通常是第一个逗号或句号前的内容）
        main_content = content.split('，')[0].split('。')[0]
        
        # 如果主要内容仍然太长，尝试提取关键信息
        if len(main_content) > 50:
            # 提取括号中的内容
            bracket_content = re.findall(r'[（\(](.*?)[）\)]', main_content)
            if bracket_content:
                # 移除括号及其内容
                main_content = re.sub(r'[（\(].*?[）\)]', '', main_content)
            
            # 提取引号中的内容
            quote_content = re.findall(r'[「""](.*?)[」""]', main_content)
            if quote_content:
                # 使用引号中的内容作为主要内容
                main_content = quote_content[0]
            
            # 如果还是太长，提取关键短语
            if len(main_content) > 50:
                # 分析句子结构，保留主要动作和对象
                parts = re.split(r'[的地得]', main_content)
                if len(parts) > 1:
                    main_content = parts[-1]  # 通常最后一部分是核心内容
        
        return main_content.strip()

    def merge_list_items(self, title: str, details: List[str]) -> str:
        """合并标题和详细信息为一个完整的总结"""
        # 提取主要动作
        action_match = re.match(r'^(完成|修复|优化|实现|新增|添加)', title)
        action = action_match.group(0) if action_match else '完成'
        
        # 优化标题内容
        core_content = self.optimize_summary(title)
        
        # 如果有详细信息，选择最重要的一条
        if details:
            important_detail = self.optimize_summary(details[0])
            if important_detail and important_detail not in core_content:
                summary = f"{action}{core_content}，{important_detail}"
            else:
                summary = f"{action}{core_content}"
        else:
            summary = f"{action}{core_content}"
        
        # 确保总结简洁明了
        if len(summary) > 60:
            # 智能压缩内容而不是简单截断
            parts = summary.split('，')
            if len(parts) > 1:
                # 只保留最重要的部分
                summary = parts[0]
            else:
                # 如果没有逗号分隔，尝试提取核心信息
                summary = self.optimize_summary(summary)
        
        return summary

    def generate_brief_summary(self, summaries: List[str]) -> str:
        """生成精简版总结"""
        brief_report = f"""# {datetime.now().strftime('%Y.%m.%d')} 工作内容

"""
        # 处理每个总结项
        for i, content in enumerate(summaries, 1):
            lines = content.split('\n') if isinstance(content, str) else [content]
            title = lines[0]
            details = [line.strip() for line in lines[1:] if line.strip().startswith('-')]
            
            # 使用更智能的方式合并内容
            summary = self.merge_list_items(title, details)
            brief_report += f"{i}. {summary}\n"
            
        return brief_report

    def generate_ai_summary(self, commits: List[Dict]) -> str:
        """使用OpenAI生成工作总结"""
        if not self.openai_api_key:
            return None

        try:
            # 准备提交记录文本
            commits_text = []
            for commit in commits:
                commit_info = (
                    f"仓库：{commit['repo']}\n"
                    f"提交信息：{commit['message']}\n"
                    f"修改文件：{', '.join(commit['files'])}\n"
                )
                commits_text.append(commit_info)

            # 构建提示词
            prompt = f"""请根据以下Git提交记录生成一份简洁的工作总结，要求：
1. 按照工作类型分类整理（如功能开发、问题修复、优化改进等）
2. 合并相似的工作内容
3. 使用简洁的语言描述，每项总结不超过70个字
4. 突出重要的工作内容
5. 总结条数限制在5-10条之间
6. 使用markdown格式，不要使用```markdown
7. 合理分类，分类标题和内容使用合理的md标题，分类标题使用四级标题，只需要给分类标题编号

提交记录：
{'\n'.join(commits_text)}
"""

            # 调用OpenAI API
            client = OpenAI(api_key=self.openai_api_key, base_url="https://api.deepseek.com")

            response = client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": "你是一名python工程师，你负责生成周报。"},
                    {"role": "user", "content": prompt},
                ],
                stream=False
            )

            # 访问 message 的内容
            ai_summary = response.choices[0].message.content.strip()
            print(ai_summary)
            return ai_summary

        except Exception as e:
            print(f"生成AI总结时出错: {str(e)}")
            return None

    def generate_report(self, commits: List[Dict], start_date: str, end_date: str) -> Tuple[str, str]:
        """生成周报和精简版总结"""
        # 尝试使用AI生成总结
        ai_summary = self.generate_ai_summary(commits)
        
        if ai_summary:
            # 使用AI生成的总结
            brief_report = f"""# {datetime.now().strftime('%Y.%m.%d')} 工作内容

{ai_summary}
"""
        else:
            # 使用原有方法生成总结
            summaries = self.summarize_commits(commits)
            brief_report = self.generate_brief_summary(summaries)

        # 生成详细报告
        detailed_report = f"""# 工作周报
## 报告期间：{start_date} 至 {end_date}

## 本周主要工作
"""
        # 按仓库分组显示提交
        repos_commits = defaultdict(list)
        for commit in commits:
            repos_commits[commit['repo']].append(commit)

        for repo, repo_commits in repos_commits.items():
            detailed_report += f"\n### {repo}\n"
            repo_summaries = self.summarize_commits(repo_commits)
            for i, summary in enumerate(repo_summaries, 1):
                detailed_report += f"{i}. {summary}\n"

        detailed_report += f"""
## 工作统计
- 涉及仓库数：{len(repos_commits)}
- 总提交数：{len(commits)}
- 活跃贡献者：{len(set(c['author'] for c in commits))}
- 变更文件数：{len(set(itertools.chain.from_iterable(c['files'] for c in commits)))}
"""

        return detailed_report, brief_report

def main():
    # 计算日期范围（最近7天）
    end_date = datetime.now()
    start_date = end_date - timedelta(days=7)
    
    # 格式化日期
    start_date_str = start_date.strftime('%Y-%m-%d')
    end_date_str = end_date.strftime('%Y-%m-%d')
    
    try:
        # 创建报告生成器实例
        generator = WeeklyReportGenerator(
            repos_root='/root/ousel/i*',  # 指定要扫描的根目录
            config_path='report_config.json'
        )
        
        # 获取所有提交并生成报告
        commits = generator.get_commits(start_date_str, end_date_str)
        if not commits:
            print("未找到任何提交记录")
            exit(0)
            
        detailed_report, brief_report = generator.generate_report(
            commits, start_date_str, end_date_str
        )
        
        # 保存报告
        reports_dir = 'reports'
        os.makedirs(reports_dir, exist_ok=True)
        
        report_date = datetime.now().strftime('%Y%m%d')
        detailed_path = os.path.join(reports_dir, f'weekly_report_{report_date}.md')
        brief_path = os.path.join(reports_dir, f'weekly_report_brief_{report_date}.md')
        
        with open(detailed_path, 'w', encoding='utf-8') as f:
            f.write(detailed_report)
        
        with open(brief_path, 'w', encoding='utf-8') as f:
            f.write(brief_report)
        
        print("报告已生成:")
        print(f"- 详细报告: {detailed_path}")
        print(f"- 精简总结: {brief_path}")
        
    except Exception as e:
        print(f"生成报告时发生错误: {str(e)}")
        traceback.print_exc()

if __name__ == '__main__':
    main() 